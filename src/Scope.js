/* jshint globalstrict: true */
'use strict';

var initWatchValue = function() {};

var Scope = function() {
  this.$$watchers = [];
  this.$$lastDirtyWatch = null;
  this.$$asyncQueue = [];
  this.$$applyAsyncQueue = [];
  this.$$applyAsyncId = null;
  this.$$phase = null;
};

//Adds a watcher and listener to the scope
Scope.prototype.$watch = function(watchFn, listenerFn, valueEq) {

  //Note: due to how the digest cycle works, watch functions should be IDEMPOTENT
  //they should have NO side effects, because they may be run a LOT each digest cycle!

  var watcher = {
    watchFn: watchFn,
    listenerFn: listenerFn || function() {},
    valueEq: !!valueEq,
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
    if (!self.$$areEqual(newValue, oldValue, watcher.valueEq)) {
      //Keep track of last dirty watch so we don't overdigest
      self.$$lastDirtyWatch = watcher;
      
      //For checking later whether the watch is dirty
      if (watcher.valueEq) {
        watcher.last = _.cloneDeep(newValue);
      } else {
        watcher.last = newValue;
      }

      //If the first time, don't send in our "dummy" old value, just send
      //back the newValue as the oldValue the first time.
      if (oldValue === initWatchValue) {
        oldValue = newValue;
      }

      //Watch is dirty, run the listener
      watcher.listenerFn(newValue, oldValue, self);

      //Need to run all the digests again since at least one watch is dirty
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
  this.$beginPhase('$digest');
  while (dirty || this.$$asyncQueue.length) {
    while(this.$$asyncQueue.length) {
      var asyncTask = this.$$asyncQueue.shift();
      asyncTask.scope.$eval(asyncTask.expression);
    }

    if (ttl === 0) {
      this.$clearPhase();
      throw 'No resolution to digest after 10 iterations!';
    }
    ttl--;
    dirty = self.$$digestOnce();
  }
  this.$clearPhase();
};

//Starts to become more useful after we implement $apply
//and for evaluating string expressions
Scope.prototype.$eval = function(expr, locals) {
  return expr(this, locals);
};

//Schedule an eval to run soon
//Designed to schedule work from inside a digest
  //Also: If no digest is in progress and there is no async queue,
  //schedule a digest to run soon
Scope.prototype.$evalAsync = function(expr) {
  var self = this;
  if (!self.$$phase && self.$$asyncQueue.length === 0) {
    setTimeout(function() {
      if (self.$$asyncQueue.length) {
        self.$digest();
      }
    }, 0);
  }
  self.$$asyncQueue.push({
    scope: self,
    expression: expr
  });
};

//Designed like apply--for integrating code that may not be aware of the
//angular life cycle
//Schedules to run the code and start a digest soon, but not immediately
//Designed for handling HTTP requests: maybe you want to run a digest
//after you get a bunch back (so HTTP requests returning almost at the same time
//will get processed in the same digest)
Scope.prototype.$applyAsync = function(expr) {
  var self = this;
  self.$$applyAsyncQueue.push(function() {
    self.$eval(expr);
  });
  if (self.$$applyAsyncId === null) {
    self.$$applyAsyncId = setTimeout(function() {
      self.$apply(function() {
        while (self.$$applyAsyncQueue.length) {
          self.$$applyAsyncQueue.shift()();
        }
        self.$$applyAsyncId = null;
      });
    }, 0);
  }
};


//Standard way to integrate external libraries into Angular
//Runs eval, then starts the digest cycle
Scope.prototype.$apply = function(expr, locals) {
  try {
    this.$beginPhase('$apply');
    return this.$eval(expr, locals);
  } finally {
    this.$clearPhase();
    this.$digest();
  }
};


Scope.prototype.$$areEqual = function(newValue, oldValue, valueEq) {
  if (valueEq) {
    return _.isEqual(newValue, oldValue);
  } else {
    return newValue === oldValue ||
      (typeof(newValue) === 'number' && typeof(oldValue) === 'number' &&
        isNaN(newValue) && isNaN(oldValue));
  }
};

Scope.prototype.$beginPhase = function(phase) {
  if (this.$$phase) {
    throw(this.$$phase + ' is already in progress!');
  }
  this.$$phase = phase;
};

Scope.prototype.$clearPhase = function(phase) {
  this.$$phase = null;
};