/* jshint globalstrict: true */
/* global Scope: false */
'use strict';

describe('Scope', function() {
  it('can be constructed and used like an object', function() {
    var scope = new Scope();
    scope.example = 1;

    expect(scope.example).toBe(1);
  });

  describe('digest', function() {

    var scope;

    beforeEach(function() {
      scope = new Scope();
    });

    it('calls the listener function of the watch on the first $digest', function() {
      var watchFn = function() {
        return 'watching!';
      };
      var listenerFn = jasmine.createSpy();

      scope.$watch(watchFn, listenerFn);
      scope.$digest();
      expect(listenerFn).toHaveBeenCalled();
    });

    it('calls the watch function with scope as the first argument', function() {
      var watchFn = jasmine.createSpy();
      var listenerFn = function() {};
      scope.$watch(watchFn, listenerFn);
      scope.$digest();

      expect(watchFn).toHaveBeenCalledWith(scope);
    });

    it('calls the listener function when the watched value changes', function() {
      scope.someValue = 'a';
      scope.counter = 0;

      scope.$watch(
        function(scope) {
          return scope.someValue;
        },
        function(newValue, oldValue, scope) {
          scope.counter++;
        }
      );

      expect(scope.counter).toBe(0);

      scope.$digest();
      expect(scope.counter).toBe(1);

      scope.$digest();
      expect(scope.counter).toBe(1);

      scope.someValue = 'b';

      scope.$digest();
      expect(scope.counter).toBe(2);

    });

    it('calls listener when the first watched value is undefined', function() {
      scope.someValue = undefined;
      scope.counter = 0;
      scope.$watch(
        function(scope) {
          return scope.someValue;
        },
        function(newValue, oldValue, scope) {
          scope.counter++;
        }
      );
      expect(scope.counter).toBe(0);

      scope.$digest();
      expect(scope.counter).toBe(1);
    });

    it('calls listener with new value as old value the first time', function() {
      scope.someValue = 'a';
      var oldValuePassedIn;

      scope.$watch(
        function(scope) {
          return scope.someValue;
        },
        function(newValue, oldValue, scope) {
          oldValuePassedIn = oldValue;
        }
      );

      scope.$digest();
      expect(oldValuePassedIn).toBe('a');
    });

    it('may have watchers that omit the listener function', function() {
      var watchFn = jasmine.createSpy().and.returnValue('something');
      scope.$watch(watchFn);

      scope.$digest();

      expect(watchFn).toHaveBeenCalled();
    });

    it('triggers chained watchers in the same digest', function() {
      scope.name = 'jane';

      //Watches nameUpper, adjust initial if it changes
      scope.$watch(
        function(scope) {
          return scope.nameUpper;
        },
        function(newValue, oldValue, scope) {
          if (newValue) {
            scope.initial = newValue.substring(0, 1) + '.';
          }
        }
      );

      //Watches name, updates nameUpper if it changes
      scope.$watch(
        function(scope) {
          return scope.name;
        },
        function(newValue, oldValue, scope) {
          if (typeof(newValue) === 'string') {
            scope.nameUpper = newValue.toUpperCase();
          } else {
            scope.nameUpper = '';
          }
        }
      );

      //Runs the first time, which runs the second listener on the first pass,
      //then the first listener on the second pass (when it notices that nameUpper has changed)
      scope.$digest();
      expect(scope.initial).toBe('J.');

      scope.name = 'Bob';
      scope.$digest();
      expect(scope.initial).toBe('B.');

    });

    it('gives up on the watches after 10 iterations', function() {
      scope.counterA = 0;
      scope.counterB = 0;

      //Create an infinite loop in the digest cycle
      scope.$watch(
        function(scope) {
          return scope.counterA;
        },
        function(newValue, oldValue, scope) {
          scope.counterB++;
        }
      );
      scope.$watch(
        function(scope) {
          return scope.counterB;
        },
        function(newValue, oldValue, scope) {
          scope.counterA++;
        }
      );

      expect(function() { scope.$digest(); }).toThrow();

    });

    it('ends the digest when the last watch is clean', function() {
      var watchExecutions = 0;
      scope.array = _.range(100);

      //Add 100 watch functions
      _.times(100, function(i) {
        scope.$watch(
          function(scope) {
            watchExecutions++;
            return scope.array[i];
          },
          function(newValue, oldValue, scope) {

          }
        );
      });

      scope.$digest();
      expect(watchExecutions).toBe(200);

      scope.array[0] = 1;
      scope.$digest();
      expect(watchExecutions).toBe(301);

    });

    it('does not end digest so that new watches are not run', function() {
      scope.aValue = 'abc';
      scope.counter = 0;

      scope.$watch(
        function(scope) {
          return scope.aValue;
        },
        function(newValue, oldValue, scope) {
          scope.$watch(
            function(scope) {
              return scope.aValue;
            },
            function(newValue, oldValue, scope) {
              scope.counter++;
            }
          );
        }
      );

      scope.$digest();

      expect(scope.counter).toBe(1);

    });

    //Necessary for array- or object-based watches that need to trigger
    //listeners when their values change
    it('compares based on value if enabled', function() {
      scope.aValue = [1, 2, 3];
      scope.counter = 0;

      scope.$watch(
        function(scope) {
          return scope.aValue;
        },
        function(newValue, oldValue, scope) {
          scope.counter++;
        },
        true
      );

      scope.$digest();
      expect(scope.counter).toBe(1);

      scope.aValue.push(4);
      scope.$digest();
      expect(scope.counter).toBe(2);

    });

    it('handles NaNs correctly', function() {
      scope.number = 0/0;
      scope.counter = 0;

      scope.$watch(
        function(scope) {
          return scope.number;
        },
        function(newValue, oldValue, scope) {
          scope.counter++;
        }
      );

      scope.$digest();
      expect(scope.counter).toBe(1);

      scope.$digest();
      expect(scope.counter).toBe(1);

    });

    it('executes $eval\'ed function and returns result', function() {
      scope.aValue = 42;

      var result = scope.$eval(function(scope) {
        return scope.aValue;
      });

      expect(result).toBe(42);
    });

    it('passes the second argument to the eval\'ed function', function() {
      scope.aValue = 42;

      var result = scope.$eval(function(scope, toAdd) {
        return scope.aValue + toAdd;
      }, 2);

      expect(result).toBe(44);
    });

    it('executes the apply\'ed function and starts the digest cycle', function() {
      scope.aValue = 'someValue';
      scope.counter = 0;

      scope.$watch(
        function(scope) {
          return scope.aValue;
        },
        function(newValue, oldValue, scope) {
          scope.counter++;
        }
      );

      scope.$digest();
      expect(scope.counter).toBe(1);

      scope.$apply(function(scope, locals) {
        scope.aValue = 'someOtherValue';
      });
      expect(scope.counter).toBe(2);
    });

    it('executes $evalAsynced function later in the same cycle', function() {
      scope.aValue = [1, 2, 3];
      scope.asyncEvaluated = false;
      scope.asyncEvaluatedImmediately = false;

      scope.$watch(
        function(scope) {
          return scope.aValue;
        },
        function(newValue, oldValue, scope) {
          scope.$evalAsync(function(scope) {
            scope.asyncEvaluated = true;
          });
          scope.asyncEvaluatedImmediately = scope.asyncEvaluated;
        }
      );

      scope.$digest();
      expect(scope.asyncEvaluated).toBe(true);
      expect(scope.asyncEvaluatedImmediately).toBe(false);
    });

    //This is added as a test case even though doing this in your angular app
    //is bad practice.  It IS still possible, so we should make sure it doesn't
    //ruin everything if someone does this.
    it('executes $evalAsynced functions added by watch functions', function() {
      scope.aValue = [1, 2, 3];
      scope.asyncEvaluated = false;

      scope.$watch(
        function(scope) {
          if (!scope.asyncEvaluated) {
            scope.$evalAsync(function(scope) {
              scope.asyncEvaluated = true
            });
          }
          return scope.aValue;
        },
        function(newValue, oldValue, scope) {}
      );

      scope.$digest();

      expect(scope.asyncEvaluated).toBe(true);
    });

    it('executes $evalAsync ed functions even when not dirty', function() {
      scope.aValue = [1, 2, 3];
      scope.evalAsyncCounter = 0;

      scope.$watch(
        function(scope) {
          if (scope.evalAsyncCounter < 2) {
            scope.$evalAsync(function(scope) {
              scope.evalAsyncCounter++;
            });
          }
          return scope.aValue;
        },
        function() {}
      );

      scope.$digest();
      expect(scope.evalAsyncCounter).toBe(2);

    });

    it('eventually halts $evalAsyncs added by watches', function() {
      scope.aValue = [1, 2, 3];

      scope.$watch(
        function(scope) {
          scope.$evalAsync(function() {})
          return scope.aValue;
        },
        function(newValue, oldValue, scope) {}
      );

      expect(function() { scope.digest() }).toThrow();
    });


  });


});