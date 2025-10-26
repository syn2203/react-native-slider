#!/usr/bin/env node

/* @flow */
const cp = require('child_process');
const {version} = require('./package.json');

function gitTagLatest() {
    cp.execFileSync('git', [
        'tag',
        '-a',
        `publish/npm/${version}`,
        '-m',
        `Publish @syn2203/react-native-slider v${version}`,
    ]);
}

process.on('SIGINT', () => process.exit(0));
// eslint-disable-next-line prettier/prettier
process.on('unhandledRejection', e => {
    throw e;
});

gitTagLatest();
