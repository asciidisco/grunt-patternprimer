'use strict';

// ext. libs
var grunt = require('grunt');
var http = require('http');

// int. libs
var primer = require('../tasks/patternprimer')(grunt);

// little helper that checks if a port is blocked
var isPortTaken = function(port, callback) {
  var net = require('net');
  var tester = net.createServer();
  tester.once('error', function (err) {
    if (err.code === 'EADDRINUSE') {
      callback(null, true);
    } else {
      callback(err);
    }
  });
  tester.once('listening', function() {
    tester.once('close', function() {
      callback(null, false);
    });
    tester.close();
  });
  tester.listen(port);
};

// Tests
exports.patternprimer = {
  // test basic server `live` output
  basic: function(test) {
    test.expect(3);
    
    var config = {
      async: function () {},
      options: function () { return {}; },
      data: {}
    };

    // run the pattern primer
    primer.bind(config)();

    // check if the default port is blocked
    isPortTaken(7020, function (err, blocked) {
      test.ok(blocked, 'Default port is blocked.');
      http.get('http://localhost:7020', function (res) {
        test.equal(res.statusCode, 200, 'Page can be delivered');
        res.on('data', function (buf) {
          test.equal(buf+'', 'Cannot find patterns folder: ./public/patterns', 'Patterns not found error message can be delivered');
          test.done();
        });
      });
    });
  },
  // test if patterns config gets loaded & delivered
  patternsCanBeDelivered: function(test) {
    test.expect(3);
    
    var config = {
      async: function () {},
      options: function () { return {}; },
      data: {
        ports: [7021, 7022],
        src: 'test/fixtures/patterns'
      }
    };

    // run the pattern primer
    primer.bind(config)();

    // check if the defined port is blocked
    isPortTaken(7021, function (err, blocked) {
      test.ok(blocked, 'User defined port will be used');
      http.get('http://localhost:7021', function (res) {
        test.equal(res.statusCode, 200, 'Page can be delivered');
        res.on('data', function (buf) {
          test.ok((buf+'').search('<h1>Level one heading</h1>'), 'Configured pattern can be delivered');
          test.done();
        });
      });
    });
  },
  // can generate a snapshot
  snapshotCanBeGenerated: function(test) {
    test.expect(4);
    
    var config = {
      async: function () { return function () {}; },
      options: function () { return {}; },
      data: {
        snapshot: true,
        src: 'test/fixtures/patterns',
        dest: 'test/fixtures/output',
        wwwroot: 'test/fixtures',
        css: ['global.css']
      }
    };

    // run the pattern primer
    primer.bind(config)();

    grunt.event.on('patternprimer:snapshot:written', function () {
      test.ok(true, 'patternprimer:snapshot:written event fired');
      test.ok(grunt.file.exists(__dirname + '/fixtures/output/index.html'), 'Snapshot pattern can be generated');
      test.ok(grunt.file.exists(__dirname + '/fixtures/output/global.css'), 'CSS can be copied');
      test.ok(grunt.file.read(__dirname + '/fixtures/output/index.html').search('<h1>Level one heading</h1>'), 'Snapshot contains patterns');
      test.done();
    });
  },
  // can deliver a snapshot
  snapshotCanBeDelivered: function(test) {
    test.expect(3);
    
    var config = {
      async: function () {},
      options: function () { return {}; },
      data: {
        ports: [7031, 7032],
        src: 'test/fixtures/patterns',
        dest: 'test/fixtures/output',
        wwwroot: 'test/fixtures',
        css: ['global.css']
      }
    };

    // run the pattern primer
    primer.bind(config)();

    // check if the defined port is blocked
    isPortTaken(7032, function (err, blocked) {
      test.ok(blocked, 'User defined port will be used');
      http.get('http://localhost:7032', function (res) {
        test.equal(res.statusCode, 200, 'Page can be delivered');
        res.on('data', function (buf) {
          test.ok((buf+'').search('<h1>Level one heading</h1>'), 'Configured pattern can be delivered');
          test.done();
        });
      });
    });
  }
};