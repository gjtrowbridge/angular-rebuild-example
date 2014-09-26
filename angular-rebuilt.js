var _ = require('lodash');

var Scope = function() {
  this.$$watchers = [];
  this.$$asyncQueue = [];
  this.$$postDigestQueue = [];
  this.$$phase = null;
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
  return function() {
    var index = this.$$watchers.indexOf(watcher);
    if (index >= 0) {
      self.$$watchers.splice(index,1);
    }
  }.bind(this);
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
  this.$beginPhase('$digest');
  while (dirty) {
    //Run all queued async code before each digest
    while (this.$$asyncQueue.length) {
      try {
        var asyncTask = this.$$asyncQueue.shift();
        this.$eval(asyncTask.expression)
      } catch(e) {
        (console.error || console.log)(e);
      }
    }
    dirty = this.$$digestOnce();
    ttl--;
    if (dirty && ttl === 0) {
      throw '10 digest iterations reached!';
    }
  }
  this.$clearPhase();

  //Run everything in the post digest queue
  //after digest is over
  while (this.$$postDigestQueue.length) {
    try {
      this.$$postDigestQueue.shift()();
    } catch(e) {
      (console.error || console.log)(e);
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
    try {
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
    } catch(e) {
      (console.error || console.log)(e);
    }
  });
  return dirty;
};

//$eval simply executes the provided function,
//passing the scope in as the first argument
Scope.prototype.$eval = function(expr, locals) {
  return expr(this, locals);
};

//Attempts to execute the function on the scope (with eval)
//then just runs digest after (regardless of success)
Scope.prototype.$apply = function(expr) {
  try {
    this.$beginPhase('$apply');
    return this.$eval(expr);
  } finally {
    this.$clearPhase();
    this.$digest();
  }
};

//Queues the given function to run AFTER the current digest is complete
//(so it runs just before the next digest starts)
//If no digest is currently scheduled, schedule it now
Scope.prototype.$evalAsync = function(expr) {
  if (!this.$$phase && !this.$$asyncQueue.length) {
    setTimeout(function() {
      if (this.$$asyncQueue.length) {
        this.$digest();
      }
    }.bind(this), 0);
  }
  this.$$asyncQueue.push({scope: this, expression: expr});
};

//Similar to evalAsync, except that this one adds to a queue
//that gets run AFTER the next digest completes (and does not
//schedule a digest if one is not currently happening)
Scope.prototype.$$postDigest = function(expr) {
  this.$$postDigestQueue.push(expr);
};

Scope.prototype.$beginPhase = function(phase) {
  if (this.$$phase) {
    throw this.$$phase + ' already in progress!';
  } else {
    this.$$phase = phase;
  }
};

Scope.prototype.$clearPhase = function() {
  this.$$phase = null;
};

/* TEST CODE BELOW HERE */

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

scope.$watch(function() {
  throw 'watch fail!';
});
scope.$watch(function() {
  scope.$evalAsync(function() {
    throw 'async fail!';
  });
});

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

scope.$evalAsync(function() {
  console.log('async code');
});

//Apply example
scope.$apply(function(scope) {
  scope.firstName = 'Gregorio!';
});


//3
console.log(scope.counter);