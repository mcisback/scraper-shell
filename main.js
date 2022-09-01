#!/usr/bin/env node

const fs = require('fs');
const fsProm = fs.promises;
const puppeteer = require('puppeteer');
// const process = require('process')
const args = process.argv.slice(2);
const ScraperShell = require('./scrapershell/scrapershell')

// console.log('process.argv.length: ', process.argv.length)
if(args.length <= 0) {
    console.log('Missing Arguments: <request_file>')

    process.exit(1)
}

const scrapershell = new ScraperShell(args[0])
scrapershell.run()

