var _ = require('lodash');

var Scope = function() {
  this.$$watchers = [];
}

// With how $digest is implemented, watches can clearly be run many times...
// this means that watch functions should be IDEMPOTENT

//watchFn is what returns the value to be checked each digest
//listenerFn is what runs if the watched value has changed
//valueEq is a flag determining how to check whether a value has changed
//(ie. equality with ===, or a deep equality check for objs/arrays?)
// in actual angular, there is shallow checking that doesn't recurse
// (which is obviously much more performant than deep checking).
// this is not implemented here

Scope.prototype.$watch = function(watchFn, listenerFn, valueEq) {
  var watcher = {
    watchFn: watchFn,
    // Just in case someone wants to register a watcher
    // with no listener (so they want to do something in 
    // just the watch function every digest)
    listenerFn: listenerFn || function() {},
    valueEq: !!valueEq
  };

  this.$$watchers.push(watcher);
};

Scope.prototype.$$areEqual = function(newValue, oldValue, valueEq) {
  if (valueEq) {
    //NaN issue is handled by loDash already
    return _.isEqual(newValue, oldValue);
  } else {
    //Handles NaN as well (only edge case here)
    return newValue === oldValue ||
        (typeof newValue === 'number' && typeof oldValue === 'number' &&
         isNaN(newValue) && isNaN(oldValue));
  }
}

//Watch functions usually have a scope object passed in as first arg
//Their job is usually just to return some value of the scope,
//so the digest knows whether the value has changed (is "dirty")

// Keeps digesting until no watch fns have changed (until the situation is "stable")
// Obviously, this can lead to infinite loops if one watchFn is watching something
// another listenerFn is changing, and they're all looped together somehow

//So usually there is a maximum # of digest loops (called TTL, or Time To Live)
Scope.prototype.$digest = function() {
  var ttl = 10;
  var dirty = true;
  while (dirty) {
    dirty = this.$$digestOnce();
    ttl--;
    if (dirty && ttl === 0) {
      throw '10 digest iterations reached!';
    }
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
    if (!self.$$areEqual(newValue, oldValue, watch.valueEq)) {
      watch.listenerFn(newValue, oldValue, self);
      //If the watch wants to do deep checking for arrays/objects,
      //(without checking if it's the same ref) we need to make a copy of the last value
      //If we did checking with ===, it would always just point to the
      //same object (unless the ref itself was changed to point elsewhere),
      //and the watch would be kind of pointless...
      if (watch.valueEq) {
        watch.last = _.cloneDeep(newValue);
      } else {
        watch.last = newValue;
      }
      dirty = true;
    }
  });
  return dirty;
};

var scope = new Scope();
scope.firstName = 'Greg';
scope.counter = 0;
scope.myObj = {
  hello: 'World'
};
scope.objCounterNoValueEq = 0;
scope.objCounterValueEq = 0;

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

// Register a watch for an object that does NOT use valueEq
// It should never call the attached listener function, even
// when that object is modified
scope.$watch(function(scope) {
  return scope.myObj;
}, function(newValue, oldValue, scope) {
  scope.objCounterNoValueEq++;
});

// Now, register almost that same watch again with valueEq flag ON
// It should never call the attached listener function, even
// when that object is modified
scope.$watch(function(scope) {
  return scope.myObj;
}, function(newValue, oldValue, scope) {
  scope.objCounterValueEq++;
}, true);

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

//1
console.log(scope.objCounterNoValueEq);
//1
console.log(scope.objCounterValueEq);
scope.myObj.chchchchanges = "this has changed";
scope.$digest();

//1
console.log(scope.objCounterNoValueEq);
//2
console.log(scope.objCounterValueEq);
scope.myObj.chchchchanges = "and again!";
scope.$digest();
scope.$digest();
scope.$digest();
//3
console.log(scope.objCounterValueEq);




