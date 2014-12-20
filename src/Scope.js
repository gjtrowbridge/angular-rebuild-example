/* jshint globalstrict: true */
'use strict';

var initWatchValue = function() {};

var Scope = function() {
  this.$$watchers = [];
  this.$$lastDirtyWatch = null;
};

//Adds a watcher and listener to the scope
Scope.prototype.$watch = function(watchFn, listenerFn) {

  //Note: due to how the digest cycle works, watch functions should be IDEMPOTENT
  //they should have NO side effects, because they may be run a LOT each digest cycle!

  var watcher = {
    watchFn: watchFn,
    listenerFn: listenerFn || function() {},
    last: initWatchValue
  };

  this.$$watchers.push(watcher);

  //Reset last dirty watch when a new watch is added...
  //necessary in cases where a listener adds a new watch
  //to the digest
  this.$$lastDirtyWatch = null;
};

//Checks the scope's watchers to see if any have changed
//If so, runs the listener function for that watcher
//This method is not present in the actual Angular--it's nested within $digest
//we pulled it out for clarity
Scope.prototype.$$digestOnce = function() {
  var self = this;
  var dirty = false;

  _.forEach(this.$$watchers, function(watcher) {
    var newValue = watcher.watchFn(self);
    var oldValue = watcher.last;
    if (oldValue !== newValue) {
      //Keep track of last dirty watch so we don't overdigest
      self.$$lastDirtyWatch = watcher;
      
      watcher.last = newValue;
      if (oldValue === initWatchValue) {
        oldValue = newValue;
      }
      watcher.listenerFn(newValue, oldValue, self);
      dirty = true;
    } else if (self.$$lastDirtyWatch === watcher) {
      return false;
    }
  });

  return dirty;
};

Scope.prototype.$digest = function() {
  var dirty = true;
  var self = this;
  var ttl = 10;

  this.$$lastDirtyWatch = null;
  while (dirty) {
    if (ttl === 0) {
      throw 'No resolution to digest after 10 iterations!';
    }
    ttl--;
    dirty = self.$$digestOnce();
  }
};