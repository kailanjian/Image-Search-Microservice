// server.js
// where your node app starts

// init project
var express = require('express');
var http = require('http');
var https = require('https');
var request = require('request');

var app = express();
var MongoClient = require('mongodb').MongoClient;


// connect to database, add a search, with the current date
function addRecentSearch(search) {
  // Connect to the db
  MongoClient.connect(process.env.MONGO_URL, function(err, db) {
    if(err) {
      console.log("Error connecting to DB!");
      return;
    }
    
    var date = new Date();
    
    var searches = db.collection("searches");
    searches.insert({
      "term": search,
      "when": date.toISOString()
    });
  });
}

// connect to database, look up recent search terms
function getRecentSearches(callback) {
    // Connect to the db
  MongoClient.connect(process.env.MONGO_URL, function(err, db) {
    if(err) {
      console.log("Error connecting to DB!");
      return;
    }
    console.log("SEARCHING...");
    var searches = db.collection("searches").find().toArray().then(
      function(data) {
        var sortedData = data;
        sortedData.sort(function(a, b) {
          return (a.when < b.when) ? 1 : -1;
        })
        callback(sortedData.slice(0,10))
      });
  });
}

// http://expressjs.com/en/starter/static-files.html
app.use(express.static('public'));

// http://expressjs.com/en/starter/basic-routing.html
app.get("/", function (request, response) {
  response.sendFile(__dirname + '/views/index.html');
});

app.get("/api/imagesearch/:search", function (request, response) {
  
  var search = request.params.search;
  var offset = request.query.offset ? request.query.offset : 1;

  // compute google individual start index, assuming pages come in sets of 10 images
  var startIndex = (offset - 1) * 10 + 1
  
  // host and path for request
  var host = "www.googleapis.com";
  var path = "/customsearch/v1?cx=007570351492255058574%3A7ufojqa2sf8&key=AIzaSyDEY2lLex8M0bj0KV0khegSxlpgMbx_x64&searchType=image&start=" + startIndex + "&q=" + encodeURI(search);
  
  var main = response;
  
  https.request({
  host: host,
  path: path}, function(response) {
      var str = '';

      //another chunk of data has been recieved, so append it to `str`
      response.on('data', function (chunk) {
        str += chunk;
      });

      //the whole response has been recieved, so we just print it out here
      response.on('end', function () {
        var object = JSON.parse(str);
        var results = [];
        for (var i = 0; i < object.items.length; i++) {
          
          var result = {
            "url": object.items[i].link,
            "snippet": object.items[i].title,
            "thumbnail": object.items[i].image.thumbnailLink,
            "context": object.items[i].image.contextLink
          };
          results.push(result);
        }
        
        addRecentSearch(search);
        
        main.send(results);
        
        // need to record this as a recent search
      });
    
      response.on('error', function() {
        console.log("error");
      })
  }).end();
  
});

// return 10 most recent searches using helper method
app.get("/api/latest/imagesearch", function (request, response) {
  getRecentSearches(function(data) {
    response.send(data);
  });
});

// listen for requests :)
var listener = app.listen(process.env.PORT, function () {
  console.log('Your app is listening on port ' + listener.address().port);
});
