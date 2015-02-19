'use strict';

var argv        = require('yargs').argv;
var path        = require('path');
var gulp        = require('gulp');
var $           = require('gulp-load-plugins')();
var del         = require('del');
var runSequence = require('run-sequence');
var source      = require('vinyl-source-stream');
var buffer      = require('vinyl-buffer');
var watchify    = require('watchify');
var browserify  = require('browserify');
var browserSync = require('browser-sync');
var reload      = browserSync.reload;


// PATH
var sourceDir        = './src';
var publicDir        = './public';
var imagesSourceDir  = path.join(sourceDir, 'images');
var stylesSourceDir  = path.join(sourceDir, 'styles');
var scriptsSourceDir = path.join(sourceDir, 'scripts');
var fontsOutputDir   = path.join(publicDir, 'fonts');
var stylesOutputDir  = path.join(publicDir, 'styles');
var scriptsOutputDir = path.join(publicDir, 'scripts');

var src = {
  fonts: 'node_modules/bootstrap-sass/assets/fonts/**',
  scripts: path.join(scriptsSourceDir, '**/*.{js,jsx}'),
  styles: path.join(stylesSourceDir, '**/*.{sass,scss}')
};

var watch = {
  styles: path.join(stylesSourceDir, '**/*.scss'),
  images: path.join(imagesSourceDir, '**/*'),
  views: path.join(publicDir, '**/*.html'),
  scripts: src.scripts
};


// Browserify
var bundleScript  = 'bundle.js';
var scriptEntries = [path.resolve(path.join(scriptsSourceDir, 'app.js'))];

var bundler = browserify({
  entries: scriptEntries,
  extensions: ['.js', '.jsx'],
  transform: ['babelify'],
  debug: !argv.production,
  cache: {},
  packageCache: {},
  fullPaths: !argv.production
});


// Autoprefixer
var AUTOPREFIXER_BROWSERS = [
  'ie >= 10',
  'ie_mob >= 10',
  'ff >= 30',
  'chrome >= 34',
  'safari >= 7',
  'opera >= 23',
  'ios >= 7',
  'android >= 4.4',
  'bb >= 10'
];


// Error Notification
var onError = function (err) {
  $.notify.onError({
    title: 'Compile Error',
    message: '<%= error.message %>'
  })(err);

  this.emit('end');
};


gulp.task('clean', del.bind(null, [
  path.join(scriptsOutputDir, '*'),
  path.join(stylesOutputDir, '*'),
  path.join(fontsOutputDir, '*')
]));

gulp.task('copy:fonts', function () {
  return gulp.src(src.fonts)
    .pipe(gulp.dest(fontsOutputDir));
});

gulp.task('build:scripts', function () {
  return bundler
    .bundle()
    .on('error', onError)
    .pipe(source(bundleScript))
    .pipe(buffer())
    .pipe($.if(!argv.production, $.sourcemaps.init({loadMaps: true})))
    .pipe($.if(!argv.production, $.sourcemaps.write('./')))
    .pipe($.if(argv.production, $.uglify()))
    .pipe(gulp.dest(scriptsOutputDir));
});

gulp.task('build:styles', function () {
  return gulp.src(src.styles)
    .pipe($.if(!argv.production, $.sourcemaps.init()))
    .pipe($.sass())
    .on('error', onError)
    .pipe($.autoprefixer({browsers: AUTOPREFIXER_BROWSERS}))
    .pipe($.if(!argv.production, $.sourcemaps.write('./')))
    .pipe($.if(argv.production, $.csso()))
    .pipe(gulp.dest(stylesOutputDir));
});

gulp.task('watchify', function () {
  var watcher = watchify(bundler);

  return watcher
    .on('update', function () {
      watcher
        .bundle()
        .on('error', onError)
        .pipe(source(bundleScript))
        .pipe(buffer())
        .pipe($.sourcemaps.init({loadMaps: true}))
        .pipe($.sourcemaps.write('./'))
        .pipe(gulp.dest(scriptsOutputDir))
        .pipe(reload({stream: true, once: true}));

      $.util.log('Updated JavaScript sources');
    })
    .bundle()
    .on('error', onError)
    .pipe(source(bundleScript))
    .pipe(gulp.dest(scriptsOutputDir));
});

gulp.task('watch:styles', function () {
  gulp.watch(watch.styles, ['build:styles', reload]);
});

gulp.task('watch:images', function () {
  gulp.watch(watch.images, reload);
});

gulp.task('watch:views', function () {
  gulp.watch(watch.views, reload);
});

gulp.task('serve', function () {
  browserSync({
    notify: false,
    server: {
      baseDir: publicDir
    }
  });
});

gulp.task('watch', function () {
  runSequence(
    'clean',
    ['copy:fonts', 'build:styles', 'watchify'],
    'serve',
    ['watch:styles', 'watch:images', 'watch:views']
  );
});

gulp.task('build', function (cb) {
  runSequence('clean', [
    'copy:fonts',
    'build:styles',
    'build:scripts'
  ], cb);
});

gulp.task('lint:eslint', function () {
  return gulp.src(src.scripts)
    .pipe($.eslint())
    .pipe($.eslint.format())
    .pipe($.eslint.failAfterError());
});

gulp.task('lint:scss-lint', function () {
  return gulp.src(src.styles)
    .pipe($.scssLint({
      customReport: $.scssLintStylish,
      bundleExec: true
    }))
    .pipe($.scssLint.failReporter());
});

gulp.task('lint', ['lint:eslint', 'lint:scss-lint']);

gulp.task('default', function () {
  runSequence('lint', 'build');
});
