# ShEx

A library for writing shell scripts in NodeJS.

Based on an earlier library for spawning child processes but
with a new API inspired by [ZX's](https://google.github.io/zx/) use 
of template literal functions.

## Installation

`npm install toptensoftware/shex`

## Usage

All commands are executed by a "shex context" that controls
how the child process is spawned.

```js
// Import
import shex from "@toptensoftware/shex";

// Create an async bash context
let $ = shex({ async: true, shell: "bash" });

// Run commands
let result = await $`ls -al`;
console.log(result.stdout);
```

Sync mode

```js
// Create a sync bash context
let $ = shex({ async: false, shell: "bash" });

// Run commands
let result = $`ls -al`;
console.log(result.stdout);
```

Without a shell, sync mode:

```js
// Disable shell
let $ = shex({ shell: false });
```


## Context Options

The following context options are available:

* `shell` - the shell to use, or false (default undefined = false)
* `async` - true for async operation, false for sync (default undefined = false)
* `env` - environment vars to be merged over `process.env` for spawned processes (default `{}`)
* `cwd` - working directory for spawned processes (default undefined)
* `nothrow` - if true, non-zero status (exit) codes from spawned processes won't throw exceptions (default undefined = false)
* `encoding` - encoding to be used on stdio streams of spawned processes (default: "utf8")
* `stdio` - default stdio configuration for spawned processes (default undefined = ['inherit', 'pipe', 'pipe'])
* `input` - input to be sent to the child process's stdin (default undefined)


## Modifying an Existing Context

You can modify an existing context with the `.set` function.

```js
// Change current directory
$.set({cwd: "./subdir"})
```

Use `.push` and `.pop` to save/restore context state:

```js
// Change current directory
$.push();
$.set({cwd: "./subdir"})

// do stuff in other directory

// Back to parent
$.pop();
```

`.push` can also take new context variables

```js
$.push({cwd: "./subdir"})
```

Both `.push` and `.set` accept a string as a new current directory

```js
$.push("./subdir")
```

## Creating New Contexts

You can also create a new context based on an existing one:

```js
// Create a new sync context
let $$ = $({async: false});
```

This can be handy for one-off invocations:

```js
let ls = $({cwd:"somdir"})`ls al`.stdout;
```

If the second parameter is a function, the current context is modified
for the duration of the callback and then restored:

```js
// Run some commands in a sub-directory
$({cwd:"somedir"}, () => {
    $`git add`
    $`git commit`
});
```


## Result Object

The result of a spawned process is returned immediately from
a sync context, or promised by an async context and has the 
following properies:

* `status` - the status (exit code) of the child process
* `stdout` - the stdout output of the child process
* `stderr` - the stderr output of the child process
* `signal` - the signal returned by the child process



## ProcessPromise

In async mode, a ProcessPromise is returned when a child
process is spawned.  It has the following members:

* `status` - returns a promise for the process exit status code and 
enables "nothrow" to prevent throwing on non-zero status
* `stdin` - the child process's `stdin` stream
* `stdout` - the child process's `stdout` stream
* `stderr` - the child process's `stderr` stream
* `pipe()` - pipes the child process's `stdout` to either another stream,
or the stdin of a another ProcessPromise


## Other Libraries and Helpers

The shex context object makes the following libraries and helpers
available:

* `$.os` - the node `os` module
* `$.fetch` - the `node-fetch-native` package
* `$.sleep(period)` - a promisified wrapper around setTimeout
* `$.chalk` - the [`chalk`](https://github.com/chalk/chalk#readme) package
* `$.raw` - marks a string as "raw" so it's not escaped/wrapped when used
as a process argument.
* `$.stdin` - reads the current process `stdin` as a string (use await 
when in async mode)
* `$.fs` - either the sync or async version (depending on context async 
setting) of node's `fs` package merged with the [`fs-extra`](https://github.com/jprichardson/node-fs-extra) package.
* `$.path` - either the node `path` or `path.posix` package (ie: a version
that uses backslash mode that matches the current shell)
* `$.glob` - either the `globby` or `globbySync` functions from the [`globby`](https://github.com/sindresorhus/globby#readme)
package.  If using Windows command shell, will also convert backslashes to 
slashes and back.
* `$.which` - either the sync or async version of the [`which`](https://github.com/npm/node-which#readme) package.