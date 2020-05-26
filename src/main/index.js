import { app, BrowserWindow, ipcMain } from 'electron'

const axios = require('axios')
const jetpack = require('fs-jetpack')
const path = require('path')

/**
 * Set `__static` path to static files in production
 * https://simulatedgreg.gitbooks.io/electron-vue/content/en/using-static-assets.html
 */
if (process.env.NODE_ENV !== 'development') {
  global.__static = require('path').join(__dirname, '/static').replace(/\\/g, '\\\\')
}

let mainWindow
const winURL = process.env.NODE_ENV === 'development'
  ? `http://localhost:9080`
  : `file://${__dirname}/index.html`

function createWindow () {
  /**
   * Initial window options
   */
  mainWindow = new BrowserWindow({
    height: 563,
    useContentSize: true,
    width: 1000,
    webPreferences: {
      nodeIntegration: true,
      webSecurity: false
    }
  })

  mainWindow.loadURL(winURL)

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.on('ready', createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow()
  }
})

/**
 * Auto Updater
 *
 * Uncomment the following code below and install `electron-updater` to
 * support auto updating. Code Signing with a valid certificate is required.
 * https://simulatedgreg.gitbooks.io/electron-vue/content/en/using-electron-builder.html#auto-updating
 */

/*
import { autoUpdater } from 'electron-updater'

autoUpdater.on('update-downloaded', () => {
  autoUpdater.quitAndInstall()
})

app.on('ready', () => {
  if (process.env.NODE_ENV === 'production') autoUpdater.checkForUpdates()
})
 */

class Catalog {
  REQUIRED_FILES = [
    'image',
//    'description',
    'binary',
  ]

  constructor(source_path, is_preinstalled, remote_source) {
    this.source_path = source_path
    this.is_preinstalled = is_preinstalled
    this.remote_source = remote_source

    this.contents = jetpack.read(path.join(this.source_path, 'index.json'), 'json');
  }

  load_remote_contents() {
    let agg = []

    if (this.remote_source) {
      for (const {entry, relative_path} of this._files()) {
        agg.push(download_catalog_path(this.remote_source, this.source_path, relative_path));
      }
    }

    return Promise.all(agg);
  }

  get catalog() {
    return this.contents
  }

  get entries() {
    return this.contents.catalog
  }

  * _files(entry_files=null) {
    /*
      returns an iterator over all the files in the catalog, with the form {entry: entry, relative_path: <path>}
    */
    if (entry_files == null) {
      entry_files = this.REQUIRED_FILES
    }

    for (const entry of this.entries) {
      for (const file of entry_files) {
        yield {
          entry: entry,
          relative_path: path.join(entry.label, entry[file])
        }
      }
    }
  }

  validate_catalog() {
    for (var {entry, relative_path} of this._files()) {
      const file_path = path.join(this.source_path, relative_path)
      if (!jetpack.exists(file_path)) {
        console.log(`Missing catalog file: ${file_path}`);
      }
    }
  }

  localize_catalog() {
    const prefix = this.is_preinstalled ? '' : 'file://'

    for (const entry of this.entries) {
      for (const file_field of this.REQUIRED_FILES) {
        if (!entry[file_field]) {
          continue;
        }
        entry[file_field] = prefix + path.join(this.source_path, entry.label, entry[file_field])
      }
    }
  }

  move_catalog(dest_path) {
    jetpack.remove(dest_path);
    jetpack.move(this.source_path, dest_path);

    delete this.contents;
  }

  static get preinstalled_path() {
    return 'static/catalog';
  }

  static get updated_path() {
    return path.join(app.getPath('userData'), 'catalog');
  }

  static get downloaded_path() {
    return path.join(app.getPath('userData'), 'tmp_catalog');
  }
}

function load_catalog(source, is_preinstalled=false, remote_source=null) {
  console.log('loading catalog from path: ' + source)

  const catalog = new Catalog(source, is_preinstalled, remote_source);

  return catalog.load_remote_contents()
    .then(() => {
      console.log("validating/localizing content")

      catalog.validate_catalog();
      catalog.localize_catalog();

      console.log('Catalog loaded and validated successfully');
      console.log('Catalog path: ' + catalog.source_path)
      console.log('Catalog contents: ' + JSON.stringify(catalog.catalog))

      return catalog;
    }).catch((error) => {
      console.log('error in catalog creation:' + error)
      console.log(error.stack)

      throw error;
    })
}

async function find_catalog() {
  /*
    Find the appropriate catalog; prefers the recently downloaded catalog to
    any previously downloaded catalog. Prefers a previously downloaded one to
    the preinstalled catalog.

    As side effects, this kicks off a new download attempt, and also consolidates
    any newly downloaded catalog into the current updated catalog.
  */
  return load_catalog(Catalog.downloaded_path)
    .then((catalog) => {
      console.log("have newly downloaded catalog -- moving into updated catalog")
      catalog.move_catalog(Catalog.updated_path);
      return load_catalog(Catalog.updated_path);
    })
    .catch((error) => {
      console.log("error with newly downloaded catalog -- using the updated catalog")
      return load_catalog(Catalog.updated_path)
    })
    .catch((error) => {
      console.log("error with updated catalog -- using the preinstalled catalog")
      return load_catalog(Catalog.preinstalled_path, true)
    })
    .finally((catalog) => {
      // kick off download attempt of catalog
      load_remote_catalog();
      return catalog;
    })
}

function load_remote_catalog() {
  /*
    Check the catalog for updates, downloading it into the downloaded path if it has changed
  */
  const catalog_url = "https://raw.githubusercontent.com/simzes/test-bitty-catalog/test-progcat/";
  const index_path = 'index.json';

  const dest_base = Catalog.downloaded_path;

  return download_catalog_path(catalog_url, dest_base, index_path)
    .then(() => {
      //console.log('downloaded catalog index successfully');

      const catalog = load_catalog(dest_base, false, catalog_url);

      //console.log("catalog contents: " + JSON.stringify(catalog.catalog))

      return catalog;
    }).catch((error) => {
      console.log('error with catalog update ' + index_path + ': ' + error);
      console.log(error.stack);

      jetpack.remove(dest_base);

      throw error;
    });
}

function download_catalog_path(base_url, base_path, download_path) {
  const source_url = base_url + download_path;
  const dest_path = path.join(base_path, download_path);

  //console.log("requesting: " + source_url + "\n    into: " + dest_path)

  return axios.get(source_url, {responseType: 'arraybuffer'})
   .then(response => {
      //console.log("download for " + dest_path + " successful: " + response.status);
      jetpack.write(dest_path, response.data);
      return dest_path;
    }).catch(error => {
      console.log("download for " + dest_path + " unsuccessful");
      throw error;
    })
}

const download_url = "https://upload.wikimedia.org/wikipedia/commons/5/5b/Name.jpg"

const data_path = app.getPath('userData');
  axios.get(download_url, {responseType: 'arraybuffer'})
  .then(response => {
    console.log("writing picture to: " + data_path);
    jetpack.write(path.join(data_path, 'test_download.jpg'), response.data);
  });

ipcMain.on('catalog', async (event) => {
  console.log('loading catalog for window');
  const catalog = await find_catalog()

  console.log('using catalog sourced from: ' + catalog.source_path)

  event.returnValue = catalog.entries
});

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

ipcMain.on('load_program', async (event, program_label) => {
  console.log('loading program with label: ' + program_label);

  await sleep(2000);
  event.sender.send('load_program_result', "donezoes!");
});
