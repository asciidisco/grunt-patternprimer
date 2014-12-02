// ext. libs
var fs = require('fs');
var http = require('http');
var path = require('path');

var connect = require('connect');
var Q = require('q');

// grunting grunts for grunt
module.exports = function(grunt) {

  // global settings
  var settings = {};

  // Default sourcefile.
  // Can be overwritten using the option `index`
  var sourceFile = [
    '<!DOCTYPE html>',
    '<head>',
    '<meta charset="utf-8">',
    '<title>Pattern Primer</title>',
    '{{css}}',
    '<style>',
    '.pattern {',
    '    clear: both;',
    '    overflow: hidden;',
    '}',
    '.pattern .display {',
    '    width: 65%;',
    '    float: left;',
    '}',
    '.pattern .source {',
    '    width: 30%;',
    '    float: right;',
    '}',
    '.pattern .source textarea {',
    '    width: 90%;',
    '}',
    '</style>',
    '</head>',
    '<body>'].join('');

  // gets the user defined source file,
  // or uses the default one
  var getSourceFile = function (cb) {
    // check if we have a custom index file set
    if (settings.index) {
      // generate the real index file path
      var indexFile = process.cwd() + '/' + settings.index;

      // check if the file exists, throw an error otherwise
      if (!grunt.file.exists(indexFile)) {
        grunt.log.error('Index file: "' + indexFile + '" not found');
        cb('Index file: "' + indexFile + '" not found');
        return;
      }

      // load the file contents
      sourceFile = grunt.file.read(indexFile);
    }

    // modify the sourcefile css according to the settings
    var css = settings.css.map(function (file) {   
      if (settings.snapshot && file.search('http://') !== -1) {
        return '<link rel="stylesheet" type="text/css" href="' + path.basename(file) + '"/>';
      } else {
        return '<link rel="stylesheet" type="text/css" href="' + file + '"/>';
      }
    });
    sourceFile = sourceFile.replace('{{css}}', css.join(''));

    // spit out the default sourcefile
    cb(sourceFile);
  };

  // generates the html output for the patterns
  var outputPatterns = function (patternFolder, patterns, cb) {
    getSourceFile(function generatePatterns(content) {
      patterns.forEach(function (file) {
        content += '<hr/>';
        content += '<div class="pattern"><div class="display">';
        content += file.content;
        content += '</div><div class="source"><textarea rows="6" cols="30">';
        content += simpleEscaper(file.content);
        content += '</textarea>';
        content += '<p><a href="/'+ patternFolder + '/' + file.filename +'">' + file.filename + '</a></p>';
        content += '</div></div>';
      });
      content += '</body></html>';
      cb(content);
    });
  };

  // walks through the pattern folder
  // reads all the contents of the pattern files 
  var handleFiles = function (patternFolder, files, cb) {
    var file, patterns = [];
    files.forEach(function readPattern(pattern) {
      file = {filename: pattern};
      file.content = grunt.file.read(patternFolder + '/' + file.filename);
      patterns.push(file);
    });

    // call the outputPatterns function that generates
    // the html for every pattern
    outputPatterns(patternFolder, patterns, cb);
  };

  // simple html escape helper
  var simpleEscaper = function (text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  };

  // reads all the patterns from the folder
  var readPatterns = function (patternFolder, cb) {
    // read pattern folder
    fs.readdir(patternFolder, function (err, contents) {
      // check for errors
      if (err !== null && err.code === 'ENOENT') {
        grunt.log.error('Cannot find patterns folder:', patternFolder);
        cb('Cannot find patterns folder: ' + patternFolder);
        return;
      }

      // list all pattern files (that end with .html)
      var files = [];
      contents.forEach(function (content) {
        if (content.substr(-5) === '.html') {
          files.push(content);
        }
      });
      // handle all the found pattern files
      handleFiles(patternFolder, files, cb);
    });
  };

  /**
   * Pattern primer base task
   */

  var patternprimer = function () {
    var done = this.async();
    var options = this.options();
    var data = this.data;

    // default settings, overwritten with user defined settings
    settings = {
      pattern_port: Array.isArray(data.ports) && data.ports[0] ? data.ports[0] : Array.isArray(options.ports) && options.ports[0] ? options.ports[0] : 7020,
      snapshot_port: Array.isArray(data.ports) && data.ports[1] ? data.ports[1] : Array.isArray(options.ports) && options.ports[1] ? options.ports[1] : 7040,
      wwwroot: data.wwwroot || options.wwwroot || 'public',
      src: data.src || options.src || 'public/patterns',
      files: data.files || options.files || [],
      dest: data.dest || options.dest || 'docs',
      snapshot: (data.snapshot !== undefined ? data.snapshot : (options.snapshot !== undefined ? options.snapshot : false)),
      index: data.index || options.index || null,
      css: data.css || options.css || ['global.css']
    };

    var primer;

    // local pattern folder (there are the html snapshots)
    if (settings.files.length > 0) {
      var patterns = settings.files;
      var patternsFolder = settings.src;

      // our main function that starts the process
      primer = function (cb) {
        handleFiles(patternsFolder, patterns, cb);
      };

    } else {
     var patternFolder = './' + settings.src;

      // our main function that starts the process
      primer = function (cb) {
        readPatterns(patternFolder, cb);
      };
    }

   

    // middleware to spit out 404 (in case a non existing ressource is request)
    // or to process the `non static` requests
    var middleware = function (req, resp) {
      if (req.url !== '/') {
        resp.writeHead(404, {
          'Content-Length': 0,
          'Content-Type': 'text/plain'
        });
        resp.end();
        return;
      }

      // 200, success, always
      resp.writeHead(200, {'Content-Type': 'text/html'});
      // run the primer with cb
      primer(resp.end.bind(resp));
    };

    // initialize the server with static routes & dynamic template middleware
    var liveServer = connect.createServer(
      connect.static(process.cwd() + '/' + settings.wwwroot),
      middleware
    );

    // initialize the static server pointing to your snapshots
    var snapshotServer = connect.createServer(connect.static(process.cwd() + '/' + settings.dest));

    // starts the live server
    var startLiveServer = function () {
      liveServer.listen(settings.pattern_port, function () {
        grunt.log.ok('You can now visit http://localhost:' + settings.pattern_port + '/ to see your patterns.');
      });
    };

    // starts the snapshot server
    var startSnapshotServer = function () {
      snapshotServer.listen(settings.snapshot_port, function () {
        grunt.log.ok('You can now visit http://localhost:' + settings.snapshot_port + '/ to see your snaphsot patterns.');
      });
    };

    // writes the task output to a file 
    var writeSnapshot = function () {
      primer(function (content) {
        var promises = [];
        // write the index file
        grunt.file.write('./' + settings.dest + '/index.html', content);
        // copy css files
        settings.css.forEach(function (file) {
          var deferred = Q.defer();
          promises.push(deferred.promise);
          if (file.search('http://') !== -1) {

            var data = '';
            http.get(file, function (res) {
              res.on('data', function(chunk) {
                data += chunk;
              });
              res.on('end', function () {
                grunt.file.write('./' + settings.dest + '/style.css', data);
                deferred.resolve();
              });
            })
            .on('err', deferred.reject);
          } else {
            grunt.file.copy('./' + settings.wwwroot + '/' + file, './' + settings.dest + '/' + file);
            deferred.resolve();
          }
        });

        grunt.log.ok('Stand-alone output can now be found in "' + settings.dest + '/"');
        grunt.event.emit('patternprimer:snapshot:written');
        if (promises.length === 0) {
          done();
        } else {
          Q.allSettled(promises).then(done);
        }
      });
    };

    // writes to file or starts a server,
    // depending on the given snapshot var
    if (!!settings.snapshot) {
      writeSnapshot();
    } else {
      startLiveServer();
      // only start snapshot server, if snapshots are available
      if (grunt.file.exists('./' + settings.dest + '/index.html')) {
        startSnapshotServer();
      }
    }

  };

  grunt.registerMultiTask('patternprimer', patternprimer);
  return patternprimer;
};
