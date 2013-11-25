module.exports = function (grunt) {
  // time grunt for measuring
  require('time-grunt')(grunt);
  // load all grunt tasks matching the `grunt-*` pattern
  require('load-grunt-tasks')(grunt);

  // project config
  grunt.initConfig({

    // clean
    clean: {
      test: ['test/fixtures/output']
    },

    // hinting
    jshint: {
      files: ['tasks/*.js', 'test/*.js'],
      options: {
        jshintrc: '.jshintrc'
      }
    },

    // unit tests
    nodeunit: {
      tests: ['test/*_test.js'],
    }

  });

  // default - does everything
  grunt.registerTask('default', ['clean:test', 'jshint', 'nodeunit']);
  grunt.registerTask('test', ['clean:test', 'jshint', 'nodeunit']);
}