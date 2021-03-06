import {argv}          from 'yargs';
import path            from 'path';
import gulp            from 'gulp';
import gulpLoadPlugins from 'gulp-load-plugins';
import del             from 'del';
import runSequence     from 'run-sequence';
import source          from 'vinyl-source-stream';
import buffer          from 'vinyl-buffer';
import watchify        from 'watchify';
import browserify      from 'browserify';
import browserSync     from 'browser-sync';
import stylelint       from 'stylelint';
import scss            from 'postcss-scss';
import reporter        from 'postcss-reporter';

const $      = gulpLoadPlugins();
const reload = browserSync.reload;


// PATH
const sourceDir        = './src';
const publicDir        = './public';
const imagesSourceDir  = path.join(sourceDir, 'images');
const stylesSourceDir  = path.join(sourceDir, 'styles');
const scriptsSourceDir = path.join(sourceDir, 'scripts');
const fontsOutputDir   = path.join(publicDir, 'fonts');
const stylesOutputDir  = path.join(publicDir, 'styles');
const scriptsOutputDir = path.join(publicDir, 'scripts');

const src = {
  fonts: 'node_modules/bootstrap-sass/assets/fonts/**',
  scripts: path.join(scriptsSourceDir, '**/*.{js,jsx}'),
  styles: path.join(stylesSourceDir, '**/*.{sass,scss}')
};

const watch = {
  styles: path.join(stylesSourceDir, '**/*.scss'),
  images: path.join(imagesSourceDir, '**/*'),
  views: path.join(publicDir, '**/*.html'),
  scripts: src.scripts
};


// Browserify
const bundleScript  = 'bundle.js';
const scriptEntries = [path.resolve(path.join(scriptsSourceDir, 'app.js'))];

const bundler = browserify({
  entries: scriptEntries,
  extensions: ['.js', '.jsx'],
  transform: ['babelify'],
  debug: !argv.production,
  cache: {},
  packageCache: {},
  fullPaths: !argv.production
});


// Autoprefixer
const AUTOPREFIXER_BROWSERS = [
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
const onError = err => {
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

gulp.task('copy:fonts', () =>
  gulp.src(src.fonts)
    .pipe(gulp.dest(fontsOutputDir))
);

gulp.task('build:scripts', () =>
  bundler
    .bundle()
    .on('error', onError)
    .pipe(source(bundleScript))
    .pipe(buffer())
    .pipe($.if(!argv.production, $.sourcemaps.init({loadMaps: true})))
    .pipe($.if(!argv.production, $.sourcemaps.write('./')))
    .pipe($.if(argv.production, $.uglify()))
    .pipe(gulp.dest(scriptsOutputDir))
);

gulp.task('build:styles', () =>
  gulp.src(src.styles)
    .pipe($.if(!argv.production, $.sourcemaps.init()))
    .pipe($.sass())
    .on('error', onError)
    .pipe($.autoprefixer({browsers: AUTOPREFIXER_BROWSERS}))
    .pipe($.if(!argv.production, $.sourcemaps.write('./')))
    .pipe($.if(argv.production, $.csso()))
    .pipe(gulp.dest(stylesOutputDir))
);

gulp.task('watchify', () => {
  const watcher = watchify(bundler);

  return watcher
    .on('update', () => {
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

gulp.task('watch:styles', () => {
  gulp.watch(watch.styles, ['build:styles', reload]);
});

gulp.task('watch:images', () => {
  gulp.watch(watch.images, reload);
});

gulp.task('watch:views', () => {
  gulp.watch(watch.views, reload);
});

gulp.task('serve', () => {
  browserSync({
    notify: false,
    server: {
      baseDir: publicDir
    }
  });
});

gulp.task('watch', () => {
  runSequence(
    'clean',
    ['copy:fonts', 'build:styles', 'watchify'],
    'serve',
    ['watch:styles', 'watch:images', 'watch:views']
  );
});

gulp.task('build', cb => {
  runSequence('clean', [
    'copy:fonts',
    'build:styles',
    'build:scripts'
  ], cb);
});

gulp.task('lint:eslint', () =>
  gulp.src(src.scripts)
    .pipe($.eslint())
    .pipe($.eslint.format())
    .pipe($.eslint.failAfterError())
);

gulp.task('lint:stylelint', () =>
  gulp.src(src.styles)
    .pipe($.postcss([
      stylelint({}),
      reporter({
        clearMessages: true,
        throwError: true
      })
    ], {
      syntax: scss
    }))
);

gulp.task('lint', ['lint:eslint', 'lint:stylelint']);

gulp.task('default', () => {
  runSequence('lint', 'build');
});
