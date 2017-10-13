## tweak-sourcemap-paths

Sourcemap files contain references to the original source file names.
The source file names are used by developer tools when debugging.

This tool allows you to tweaking the paths to the original source filenames.

---

Many sourcemap tools will embed relative paths to source files (like `../../foo/bar.js`), or include unnecessary paths (like `src/core`).

This tool allows you to replace patterns in the filenames with more ergonomic names, such as the name of your package.

For example, it can change `../../src/index.js` to `tweak-sourcemap-paths/index.js`, or `./src/core/index.js` to `tweak-sourcemap-paths/index.js`

### Usage

To use, create a JSON file called .tweak-sourcemap-paths.js in your project root:

```js
module.exports = function(packageJson) {
  return {
    mapGlob: [
      "dist/**/*.map"
    ],
    paths: [
      { 
        find: new RegExp("^../.."),
        replace: packageJson.name
      },
      { 
        find: new RegExp("./src/core/"),
        replace: packageJson.name
      },
    ]
  }
}
```

Then run `npx tweak-sourcemap-paths` (or `./node_modules/.bin/tweak-sourcemap-paths`) after your build step.
