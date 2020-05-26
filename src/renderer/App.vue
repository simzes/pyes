<template>
  <div id="app">
    <h3> {{ selection ? selection.title : "" }} </h3>
    <div class="catalogPane">
      <template v-for="entry in catalog">
        <div class="entryTile">
          <p> {{ entry.title }} </p>
          <p> label: {{ entry.label }} </p>
          <img v-bind:src="entry.image"
               v-on:click="entrySelect(entry.label)"
          />
          <p> description: {{ entry.description }} </p>
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
        <h3> {{ selection.title }} </h3>
        <p class="selectionDescription">
          {{ selection.description }}
        </p>
      </div>
    </div>
  </div>
</template>

<script>
  const { remote } = window.require('electron')
  const {  ipcRenderer } = require('electron');

  export default {
    name: 'ToDos',
    data: () => {
      return {
        stuff: "stuff2",
        selection: { title: "stuff", description: "more stuff" },
        loading: { inProgress: false, feedback: "", initialFeedback: "Loading...", maxFeedback: 20 },
        catalog: []
      }
    },
    methods: {
      entrySelect: function (label) {
        console.log("selected: " + label);
        this.selection = this.entryFromLabel(label);
      },
      upload: function () {
        if (!this.selection.label) {
          console.log("nothing selected! can't upload");
          return;
        }

        if (this.loading.inProgress) {
          console.log("loading already in progress! can't interrupt");
          return;
        }

        console.log("upload!");
        this.loading.inProgress = true;

        Promise.resolve()
        .then(() => {
          this.resetLoadingFeedback();

          this.interval = setInterval(function () {
            this.bumpLoading()
          }.bind(this), 750);
        })
        .then(() => this.uploadAsync())
        .then((upload_result) => {
          console.log('load program result: ' + upload_result);
          this.loading.feedback = upload_result;
        })
        .finally(() => {
          clearInterval(this.interval);
          this.loading.inProgress = false
        })
      },
      uploadAsync: function () {
        return new Promise((resolve, reject) => {
          this.loading.async_result = resolve;
          this.$electron.ipcRenderer.send('load_program', this.selection.label);
        });
      },
      uploadResult: function (event, arg) {
        console.log('upload result called!')
      },
      bumpLoading: function () {
        console.log('loading bump!');
        this.loading.feedback += ".";
        if (this.loading.feedback.length > this.loading.maxFeedback) this.resetLoadingFeedback()
      },
      resetLoadingFeedback: function () {
        this.loading.feedback = this.loading.initialFeedback;
      },
      entryFromLabel: function (label) {
        for (var entry of this.catalog)
          if (label === entry.label)
            return entry;
        return null;
      },
      handle_catalog: function(catalog) {
        console.log('handling catalog: ' + catalog);
      }
    },
    mounted: function () {
      this.$electron.ipcRenderer.on('load_program_result', this.uploadResult);
      this.catalog = this.$electron.ipcRenderer.sendSync('catalog');
    }
  }
</script>
<style>
  /* CSS */
</style>
