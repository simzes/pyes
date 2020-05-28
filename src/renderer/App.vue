<template>
  <div id="app">
    <h3> {{ selection.entry.title }} </h3>
    <div class="catalogPane">
        <template v-for="entry in catalog.entries">
          <div class="entryTile">
            <p> {{ entry.title }} </p>
            <p> label: {{ entry.label }} </p>
            <img v-bind:src="entry.image"
                 v-on:click="entrySelect(entry.label)"
            />
            <div v-html="entry.markdown"></div>
          </div>
        </template>
    </div>
    <div class="selectionPane">
      <button v-on:click="upload">
        Upload
      </button>
      <div class="uploadFeedback">
        <p>
          {{ loading.feedback }}
        </p>
      </div>
        <div class="selectionTile">
          <h3> {{ selection.entry.title }} </h3>
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
    name: 'catalog',
    data: () => {
      return {
        selection: null,
        loading: { inProgress: false, feedback: "", initialFeedback: "Loading...", maxFeedback: 20 },
        catalog: null,
        /* Catalog example:
        [
          {
            label: "unique label", // the path to the folder where this entry is
            title: "text about the folder", // the text to use if markdown is not present
            image: "image src", // the path to use in an image element
            description: "html from markdown", // the html to include in the entry description
            binary: "path/to/hexfile", // the path to the program binary
          },
          ...
        ]
        */
      }
    },
    methods: {
      entrySelect: function (label) {
        console.log("selected: " + label);
        this.selection = {
          entry: this.entryFromLabel(label),
          uploadable: true,
        }
      },
      entryDeselect: function () {
        this.selection = {
          entry: this.catalog.landing,
          uploadable: false,
          markdown: ""
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
          this.resetLoadingFeedback();

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
        return new Promise((resolve, reject) => {
          this.loading.async_result = resolve;
          this.$electron.ipcRenderer.send('upload', this.selection.entry);
        });
      },
      uploadReply: function (event, arg) {
        console.log('upload result called!')
        this.loading.async_result(arg)
        delete this.loading.async_result;
      },
      bumpLoading: function () {
        console.log('loading bump!');
        if (this.loading.feedback.length >= this.loading.maxFeedback) {
          this.resetLoadingFeedback()
          return;
        }
        this.loading.feedback += ".";
      },
      resetLoadingFeedback: function () {
        this.loading.feedback = this.loading.initialFeedback;
      },
      entryFromLabel: function (label) {
        for (var entry of this.catalog.entries)
          if (label === entry.label)
            return entry;
        return null;
      },
      handle_catalog: function(catalog) {
        console.log('handling catalog: ' + catalog);
      }
    },
    created: function() {
      this.catalog = this.$electron.ipcRenderer.sendSync('catalog');
      this.entryDeselect();
    },
    mounted: function () {
      this.$electron.ipcRenderer.on('upload_reply', this.uploadReply);

    }
  }
</script>
<style>
  /* CSS */
</style>
