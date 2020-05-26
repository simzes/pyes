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
        catalog: [
          {
            label: "elephant",
            title: "Elephant Bitty",
            image: "static/elephant.jpg",
            description: "what is an elephant even?",
          },
          {
            label: "donkey",
            title: "Donkey Bitty",
            image: "static/donkey.jpg",
            description: "what is a donkey even?",
          }
        ]
      }
    },
    methods: {
      entrySelect: function (label) {
        console.log("selected: " + label);
        this.selection = this.entryFromLabel(label);
      },
      upload: function () {
        console.log("upload!");
        if (this.selection.label) {
          this.uploadAsync();
        }
      },
      uploadAsync: async function () {
          this.interval = setInterval(function () {
            this.bumpLoading()
          }.bind(this), 750);

        return new Promise((resolve, reject) => {
          console.log('load program result: ' + this.$electron.ipcRenderer.sendSync('load_program', this.selection.label));
          clearInterval(this.interval);
        })
      },
      bumpLoading: function () {
        console.log('loading bump!');
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
      this.catalog = this.$electron.ipcRenderer.sendSync('catalog');
    }
  }
</script>
<style>
  /* CSS */
</style>
