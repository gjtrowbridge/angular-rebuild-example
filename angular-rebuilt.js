var _ = require('underscore');

var Scope = function() {
  this.$$watchers = [];
}

Scope.prototype.$watch = function(watchFn, listenerFn) {
  var watcher = {
    watchFn: watchFn,
    // Just in case someone wants to register a watcher
    // with no listener (so they want to do something in 
    // just the watch function every digest)
    listenerFn: listenerFn || function() {}
  };
  this.$$watchers.push(watcher);
};

//Watch functions usually have a scope object passed in as first arg
//Their job is usually just to return some value of the scope,
//so the digest knows whether the value has changed (is "dirty")

// Keeps digesting until no watch fns have changed (until the situation is "stable")
Scope.prototype.$digest = function() {
  var dirty = true;
  while (dirty) {
    dirty = this.$$digestOnce();
  }
}

// Added digestOnce so that if a listener
// changes a watched value, it will always get "caught"/"noticed"
// before the digesting is done (only moves on when digestOnce finds
// no watch values that have changed)
Scope.prototype.$$digestOnce = function() {
  var self = this;
  var dirty = false;
  _.forEach(this.$$watchers, function(watch) {
    var newValue = watch.watchFn(self);
    var oldValue = watch.last;
    if (newValue !== oldValue) {
      watch.listenerFn(newValue, oldValue, self);
      watch.last = newValue;
      dirty = true;
    }
  });
  return dirty;
};

var scope = new Scope();
scope.firstName = 'Greg';
scope.counter = 0;

// Register watcher for firstName property
scope.$watch(function(scope) {
  return scope.firstName;
}, function(newValue, oldValue, scope) {
  scope.counter++;
});

// Register watcher that just logs whenever a digest
// happens
scope.$watch(function(scope) {
  console.log('digest happened!');
});

//0
console.log(scope.counter);

//1
scope.$digest();
console.log(scope.counter);

scope.$digest();
scope.$digest();
scope.$digest();
//1 again -- listenerFn only runs when watchFn
//returns a different value than last time
console.log(scope.counter);

scope.firstName = 'Bill';
scope.$digest();
//2
console.log(scope.counter);


