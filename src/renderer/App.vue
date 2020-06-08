<template>
  <div id="app" class="appWindow">
    <div class="catalogPane">
        <template v-for="entry in catalog.entries">
          <div v-bind:class="entry._cssClass">
            <img v-bind:src="entry.icon"
                 v-on:click="entrySelect(entry)"
                 class="entryImage"
            />
            <h3 class="entryTitle"> {{ entry.title }} </h3>
          </div>
        </template>
    </div>
    <div class="selectionPane">
      <div class="uploadBlock">
        <button v-on:click="upload" class="uploadButton">
          <h3 class="uploadText">Upload</h3>
        </button>
        <div class="uploadFeedback">
          <p>
            {{ loading.feedback }}
          </p>
        </div>
      </div>
      <div class="selectionTile">
        <h3 class="selectionTitle"> {{ selection.entry.title }} </h3>
        <div v-html="selection.entry.markdown" class="selectionDescription">
        </div>
      </div>
    </div>
  </div>
</template>

<script>
  const { remote } = window.require('electron')
  const {  ipcRenderer } = require('electron');

  export default {
    /*
      Catalog sets up an html page structured around catalog entries, and one
      selected entry.
    */
    name: 'catalog',
    data: () => {
      return {
        selection: null,
          /* the entry selected and displayed */
        loading: { inProgress: false, feedback: "", initialFeedback: "Loading...", maxFeedback: 20 },
          /* the structure for handling loading feedback, and blocking extraneous clicks */
        catalog: null,
        /* The catalog

        Example:
        [
          {
            path: "unique label", // the path to the folder where this entry is
            title: "text about the folder", // the text to use if markdown is not present
            icon: "image src", // the path to use in an image element
            markdown: "html from markdown", // the html to include in the entry description
            binary: "path/to/hexfile", // the path to the program binary
          },
          ...
        ]
        */
      }
    },
    methods: {
      entrySelect: function (entry) {
        /* Updates the display for a selection */
        console.log("selected: " + entry.path);

        this.resetEntrySelect();

        entry._cssClass += " selectedEntryTile";

        this.selection = {
          entry: entry,
          uploadable: true,
        }
      },
      entryDeselect: function () {
        /* Resets the display for the landing selection */
        this.resetEntrySelect();

        this.selection = {
          entry: this.catalog.landing,
          uploadable: false,
          markdown: ""
        }
      },
      resetEntrySelect: function () {
        /* Sets all entry css classes to unselected (used for border) */
        for (const entry of this.catalog.entries) {
          entry._cssClass = "entryTile";
        }
      },
      upload: function () {
        if (!this.selection.uploadable) {
          console.log("nothing selected! can't upload");
          return;
        }

        if (this.loading.inProgress) {
          console.log("loading already in progress! can't interrupt");
          return;
        }

        console.log("uploading: " + this.selection);
        this.loading.inProgress = true;

        Promise.resolve()
        .then(() => {
          this.bumpLoading(true)
          this.interval = setInterval(function () {
            this.bumpLoading()
          }.bind(this), 750);
        })
        .then(() => this.uploadSend())
        .finally(() => {
          clearInterval(this.interval);
          this.loading.inProgress = false
        })
        .then((upload_result) => {
          console.log('load program result: ' + upload_result);
          this.loading.feedback = upload_result;
        })
      },
      uploadSend: function () {
        /* Sends the selected entry and catalog for upload

        Returns a promise object of when the upload is finished

        Works in conjunction with uploadReply, which calls into the
        async_result function set up in this method
       */
        return new Promise((resolve, reject) => {
          this.loading.async_result = resolve;
          this.$electron.ipcRenderer.send('upload', this.selection.entry, this.catalog);
        });
      },
      uploadReply: function (event, arg) {
        /* Registered listener function for upload_reply */
        console.log('upload result called!')
        this.loading.async_result(arg)
        delete this.loading.async_result;
      },
      bumpLoading: function (first_setup=false) {
        /* Handles adding another dot to Loading..., and resetting when done */
        console.log('loading bump!');
        if (first_setup || this.loading.feedback.length >= this.loading.maxFeedback) {
          this.loading.feedback = this.loading.initialFeedback;
          return
        }
        this.loading.feedback += ".";
      },
      handle_catalog: function(catalog) {
        console.log('handling catalog: ' + catalog);
      }
    },
    created: function() {
      /* Lifecycle function: requests the catalog, and sets up the landing entry */
      this.catalog = this.$electron.ipcRenderer.sendSync('catalog');
      this.entryDeselect();
    },
    mounted: function () {
      /*
        Lifecycle function: sets up the upload_reply listener (needed for
        asynchronous/background uploading)
      */
      this.$electron.ipcRenderer.on('upload_reply', this.uploadReply);

    }
  }
</script>
<style>

html,
body,
div,
span,
applet,
object,
iframe,
h1,
h2,
h3,
h4,
h5,
h6,
p,
blockquote,
pre,
a,
abbr,
acronym,
address,
big,
cite,
code,
del,
dfn,
em,
img,
ins,
kbd,
q,
s,
samp,
small,
strike,
strong,
sub,
sup,
tt,
var,
b,
u,
i,
center,
dl,
dt,
dd,
ol,
ul,
li,
fieldset,
form,
label,
legend,
table,
caption,
tbody,
tfoot,
thead,
tr,
th,
td,
article,
aside,
canvas,
details,
embed,
figure,
figcaption,
footer,
header,
hgroup,
menu,
nav,
output,
ruby,
section,
summary,
time,
mark,
audio,
video {
  margin: 0;
  padding: 0;
  border: 0;
  font-size: 100%;
  /* Prevent font scaling in landscape while allowing user zoom */
  -ms-text-size-adjust: 100%;
  -moz-text-size-adjust: 100%;
  -webkit-text-size-adjust: 100%;
  text-size-adjust: 100%;
  font-family: "Droid Sans Fallback", sans-serif;
  vertical-align: baseline;

  color: white;
}

body {
  background-color: #292929;
  overflow-x: hidden;
}

h3 {
  font-size: 14pt;
}

p {
  font-size: 12pt;
}

.appWindow {
}

.catalogPane {
  position: absolute;
  top: 0;
  left: 0;

  height: 100%;
  width: calc(100% - 360px);

  padding-top: 20px;
  padding-bottom: 20px;
  padding-left: 20px;

  display: flex;
  justify-content: left;
  flex-direction: row;
  flex-wrap: wrap;

  align-items: baseline;
  align-content: baseline;
}

.entryTile {
  height: auto;
  width: 240px;

  padding-top: 20px;
  padding-bottom: 20px;
  margin-bottom: 20px;
  padding-left: 10px;
  padding-right: 10px;

  display: flex;
  flex-direction: column;
  align-items: center;
}

.selectedEntryTile {
  outline: solid;
  outline-color: #4baecb;
}

.entryImage {
  height: 200px;
  width: 200px;
}

.entryTitle {
  padding-top: 10px;
  width: 200px;
}

.selectionPane {
  position: absolute;
  top: 0;
  right: 0;

  height: 100%;
  width: 340px;

  padding-top: 30px;
  padding-bottom: 30px;

  display: flex;
  flex-direction: column;
  align-items: left;

  background-color: #292929;
}

.uploadBlock {
  height: auto;
  width: 100%;

  padding-left: 10px;
}

.uploadButton {
  height: 65px;
  width: 85%;

  border: none;
  border-radius: 5pt;
  outline: 0;

  background-color: #ff00fe;
}

.uploadButton:active {
  background-color: #4baecb;
}

.uploadFeedback {
  min-height: 40px;
  padding-top: 15px;
}

.selectionTile {
  width: calc(100% - 20px);
  padding-left: 15px;
  padding-top: 15px;

  display: flex;
  flex-direction: column;
}

.selectionTitle {
  width: calc(100% - 15px);
  padding-bottom: 10px;
}

.selectionDescription {
  flex-shrink: 2;
  padding-bottom: 20px;
}

</style>
