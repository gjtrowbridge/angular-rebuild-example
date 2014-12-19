/* jshint globalstrict: true */
'use strict';

var initWatchValue = function() {};

var Scope = function() {
  this.$$watchers = [];
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
      watcher.last = newValue;
      if (oldValue === initWatchValue) {
        oldValue = newValue;
      }
      watcher.listenerFn(newValue, oldValue, self);
      dirty = true;
    }
  });

  return dirty;
};

Scope.prototype.$digest = function() {
  var dirty = true;
  var self = this;
  var ttl = 10;

  while (dirty) {
    if (ttl === 0) {
      throw 'No resolution to digest after 10 iterations!';
    }
    ttl--;
    dirty = self.$$digestOnce();
  }
};