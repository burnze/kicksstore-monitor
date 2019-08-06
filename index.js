const request      = require('request');
const cheerio      = require('cheerio');
const fs           = require('fs');
const products     = require('./products');
const config       = require('./config');
let proxyList      = [];

let availableSizes1 = [];
let availableSizes2 = [];

function monitor(product) {
    request({
        url: product.url,
        proxy: formatProxy(proxyList[Math.floor(Math.random() * proxyList.length)])
    }, (err, res, body) => {
        if (res.statusCode == 200) {
            const $ = cheerio.load(body);
            $('.size_box').each((i, el) => {
                let size = $(el).text()
                availableSizes1.push(size)
           })
           if (availableSizes1.length) compare(product);
        } else {
            console.log('Error on obtaining product page, response status code: ' + res.statusCode)
            console.log('Retrying in ' + (config.delay/1000) + ' second/s')
            setTimeout(() => {
                monitor(product)
            }, config.delay)
        };
    });
};

function compare(product) {
    request({
        url: product.url,
        proxy: formatProxy(proxyList[Math.floor(Math.random() * proxyList.length)])
    }, (err, res, body) => {
        if (res.statusCode == 200) {
            const $ = cheerio.load(body);
            const productTitle = $('meta[property="og:title"]').attr('content')
            $('.size_box').each((i, el) => {
                let size = $(el).text()
                availableSizes2.push(size)
           })
           if (availableSizes2.length > availableSizes1.length) {
               let newSize = availableSizes2.filter(value => {
                   return (!availableSizes1.includes(value)) 
               })
               webhook(productTitle, product.url, newSize.join())
               console.log('Size restocked: ' + newSize)
               availableSizes1.length = 0
               availableSizes2.length = 0
               setTimeout(() => {
                   monitor(product)
               })
           } else {
               console.log('Monitoring product: ' + productTitle)
               availableSizes1.length = 0
               availableSizes2.length = 0
               setTimeout(() => {
                   monitor(product)
               }, config.delay)
           };
        };
    });
};

function webhook(productTitle, productUrl, size) {
    const body = { 
        "username": "KicksStore Monitor",
        "embeds": [
            {
              "title": "Size restocked!",
              "description": `[${productTitle}](${productUrl})`,
              "color": 16711935,
              "footer": {
                "text": "KicksStore Monitor"
              },
              "fields": [
                {
                  "name": "Size",
                  "value": size,
                  "inline": true
                },
              ],
              timestamp: new Date()
            },
          ]
        };
    request({
        url: config.webhook,
        method: 'POST',
        body: body,
        json: true
    }, (err) => {
        if (err) console.log('Error sending webhook: ' + err);
    });
};

function formatProxy(proxy) {
    if (proxy && ['localhost', ''].indexOf(proxy) < 0) {
        proxy = proxy.replace(' ', '_');
        const proxySplit = proxy.split(':');
        if (proxySplit.length > 3)
            return "http://" + proxySplit[2] + ":" + proxySplit[3] + "@" + proxySplit[0] + ":" + proxySplit[1];
        else
            return "http://" + proxySplit[0] + ":" + proxySplit[1];
    }
    else
        return undefined;
}

function start(){
    const proxyInput = fs.readFileSync('proxies.txt').toString().split('\n');
        for (let p = 0; p < proxyInput.length; p++) {
          proxyInput[p] = proxyInput[p].replace('\r', '').replace('\n', '');
          if (proxyInput[p] != '')
              proxyList.push(proxyInput[p]);
      }
      if (proxyList.length > 0) console.log('Found ' + proxyList.length + ' proxies');
      for (let product of products) {
        monitor(product)
    };
};

start();
