import { app, BrowserWindow, ipcMain } from 'electron'

const axios = require('axios')
const jetpack = require('fs-jetpack')
const path = require('path')

const Avrgirl = require('avrgirl-arduino');
const showdown  = require('showdown');

const Ajv = require('ajv');

/**
 * Set `__static` path to static files in production
 * https://simulatedgreg.gitbooks.io/electron-vue/content/en/using-static-assets.html
 */
if (process.env.NODE_ENV !== 'development') {
  global.__static = require('path').join(__dirname, '/static').replace(/\\/g, '\\\\')
} else {
  global.__static = './static';
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
    height: app_config.window.height || 550,
    width: app_config.window.width || 900,
    webPreferences: {
      nodeIntegration: true,
      webSecurity: false
    },
    title: app_config.window.title || "progcat_arduino",
    icon: path.join(__static, "../", "icons", "icon.png"),
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

const app_config = jetpack.read(path.join(__static, './config.json'), 'json');

console.log('app config: ')
console.log(JSON.stringify(app_config))

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
    'icon',
    'description',
    'binary',
  ]

  constructor(source_path, remote_source) {
    this.source_path = source_path
    this.remote_source = remote_source

    this.contents = jetpack.read(path.join(this.source_path, 'index.json'), 'json');
  }

  load_contents() {
    let agg = []

    if (this.remote_source) {
      if (this.contents.source.description) {
        agg.push(download_catalog_path(this.remote_source, this.source_path, this.contents.source.description))
      }
      for (const {entry, property} of this._properties()) {
        agg.push(download_catalog_path(this.remote_source, this.source_path, path.join(entry.path, entry[property])));
      }
    } else {
      for (var {entry, property} of this._properties()) {
        const file_path = path.join(this.source_path, entry.path, entry[property])
        if (!jetpack.exists(file_path)) {
          throw `Missing catalog file: ${file_path}`;
        }
      }
    }

    return Promise.all(agg);
  }

  * _properties(entry_properties=null) {
    /*
      returns an iterator over all the entries in the catalog, with form {entry: entry, relative_path: <path>}
    */
    if (entry_properties == null) {
      entry_properties = this.REQUIRED_FILES
    }

    for (const entry of this.contents.entries) {
      for (const prop of entry_properties) {
        yield {
          entry: entry,
          property: prop,
        }
      }
    }
  }

  validate_catalog() {
    const schema = jetpack.read(path.join(__static, "catalog_schema.json"), "json");

    if (!this.contents) throw "no catalog found";
    if (!schema) throw "no schema found";

    const ajv = new Ajv();
    const valid = ajv.validate(schema, this.contents);

    if (!valid) throw "catalog invalid";
    console.log("catalog index passed validation");
  }

  localize_catalog() {
    const prefix = 'file://';

    for (var {entry, property} of this._properties()) {
      entry[property] = path.join(this.source_path, entry.path, entry[property])
      if (property == 'icon') {
        entry[property] = prefix + entry[property]
      }
    }
  }

  convert_markdown() {
    const converter = new showdown.Converter();

    this.contents.landing = { title: "", markdown: "" }

    if (this.contents.source.description) {
      const markdown_contents = jetpack.read(path.join(this.source_path, this.contents.source.description))

      this.contents.landing.title = this.contents.source.name
      this.contents.landing.markdown = converter.makeHtml(markdown_contents)
    }

    for (var {entry, property} of this._properties(["description"])) {
      const markdown_contents = jetpack.read(entry[property])
      entry.markdown = converter.makeHtml(markdown_contents)
    }
  }

  move_catalog(dest_path) {
    jetpack.remove(dest_path);
    jetpack.move(this.source_path, dest_path);

    delete this.contents;
  }

  static get preinstalled_path() {
    return path.join(__static, 'catalog');
  }

  static get updated_path() {
    return path.join(app.getPath('userData'), 'catalog');
  }

  static get downloaded_path() {
    return path.join(app.getPath('userData'), 'tmp_catalog');
  }
}

function load_catalog(source, remote_source=null) {
  console.log('loading catalog from path: ' + source)

  const catalog = new Catalog(source, remote_source);

  return Promise.resolve()
    .then(() => catalog.validate_catalog())
    .then(() => catalog.load_contents())
    .then(() => {
      console.log("validating/localizing content")

      catalog.localize_catalog();
      catalog.convert_markdown();

      console.log('Catalog loaded and validated successfully');
      console.log('Catalog path: ' + catalog.source_path)
      console.log('Catalog contents: ' + JSON.stringify(catalog.contents, null, 2))

      return catalog;
    }).catch((error) => {
      console.log('error in catalog creation: ' + error)
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
  if (!app_config.remote_catalog || app_config.remote_catalog.enable_updates === false) {
    console.log("catalog updates disabled -- using preinstalled catalog")
    return load_catalog(Catalog.preinstalled_path)
      .catch((error) => {
        console.log('error with preinstalled catalog: ' + error)
        return null;
      });
  }

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
      return load_catalog(Catalog.preinstalled_path)
    })
    .catch((error) => {
      // catalog or null
      console.log('error with preinstalled catalog: ' + error)
      return null;
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
  const {username, repository, branch} = app_config.remote_catalog

  const catalog_url = `https://raw.githubusercontent.com/${username}/${repository}/${branch}/`;
  const index_path = 'index.json';

  const dest_base = Catalog.downloaded_path;

  return download_catalog_path(catalog_url, dest_base, index_path)
    .then(() => {
      //console.log('downloaded catalog index successfully');

      const catalog = load_catalog(dest_base, catalog_url);

      //console.log("catalog contents: " + JSON.stringify(catalog.catalog))

      return catalog;
    }).catch((error) => {
      console.log('error with catalog update ' + index_path + ': ' + error);
      console.log(error.stack);

      jetpack.remove(dest_base);
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

  if (catalog) {
    console.log('UI using catalog sourced from: ' + catalog.source_path)
    event.returnValue = catalog.contents
  } else {
    console.log('no valid catalog found for UI')
    event.returnValue = null
  }
});

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

ipcMain.on('upload', async (event, catalog_entry, catalog) => {
  new Promise((resolve, reject) => {
    const program_title = catalog_entry.title
    const program_path = catalog_entry.binary
    const upload_board = catalog.upload.board

    console.log(`loading program "${program_title}" from path: ${program_path} onto board: ${upload_board}`);

    var avrgirl = new Avrgirl({
      board: upload_board
    });

    if (!jetpack.exists(program_path)) {
      reject("path doesn't exist: " + program_path);
    }

    avrgirl.flash(program_path, function (error) {
      if (error) {
        console.log('load program error: ' + error)
        reject(error);
      } else {
        console.log('load program success: done')
        resolve('Done');
      }
    })
  })
  .then(msg => event.sender.send('upload_reply', msg))
  .catch(err_msg => event.sender.send('upload_reply', "" + err_msg))
});
