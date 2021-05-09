                                    88                                                    
                                    ""              ,d                                    
                                                    88                                    
    ,adPPYba,  ,adPPYba, 8b,dPPYba, 88 8b,dPPYba, MM88MMM 88       88 88,dPYba,,adPYba,   
    I8[    "" a8"     "" 88P'   "Y8 88 88P'    "8a  88    88       88 88P'   "88"    "8a  
     `"Y8ba,  8b         88         88 88       d8  88    88       88 88      88      88  
    aa    ]8I "8a,   ,aa 88         88 88b,   ,a8"  88,   "8a,   ,a88 88      88      88  
    `"YbbdP"'  `"Ybbd8"' 88         88 88`YbbdP"'   "Y888  `"YbbdP'Y8 88      88      88  
                                       88                                                 
                                       88                                                 
                                   
**[Status: work in progress]**

# Gradual Typed Functional Programming with Javascript

scriptum consists of two parts:

* a runtime type validator
* a typed standard library

Just like Typescript scriptum enables gradual typing in Javascript but with a radically different approach. While Typescript targets the object oriented aspects of Javascript, scriptum embraces its functional capabilities.

## Runtime Type Validator

Usually the type system is designed first and the rest of the language around it. However, with Javascript we are stuck with an untyped language. Adding a type system with hindsight is a Sisyphean task as you can observe with Typescript.

scriptum partially bypasses this problem by implementing only a part of a traditional type checker: It checks applications but no definitions, i.e. there is no automatic inference from terms to types but terms have to be annotated explicitly.

Explicit annotations sounds laborious. How can we reduce them? If we validate types at runtime we can resort to Javascript's introspection means. This at least frees us from explicitly typing non-functional terms. Furthermore, if we have access to an extensive typed functional library, we only have to annotate our own combinators. This is what scriptum offers.

The type validator is based on the Hindley-Milner type system extended by higher-kinded/rank types and row polymorphism. Do not be scared by the type theory lingo. This introduction explains these concepts in Layman's terms together with practical examples.

## Standard Functional Library

The standard library ships with a great variety of typed functional combinators most functional programmers are accustomed to. Additionally it supplies basic tools that enable programmers to address problems in a purely functional manner, like...

* stack-safe sync/async recursion
* persistent data structures
* local mutation without sharing
* effect handling and composition
* expressions in weak head normal form

We will deepen these concepts in the course of this introduction.

## Type Representation

The type validator operates at runtime and thus can represent types as first class `String`s. Here is our first simple type:

```javascript
"String => Number"
```

This is just a string, i.e. we can assign it to a variable, pass it around or manipulate it with Javascript's string operations.

## Associate Types with Functions

We need the `fun` operator to associate a type with a function:

```javascript
const length = fun(s => s.length, "String => Number");

length("Dijkstra"); // 8
length([1, 2, 3]); // type error
```

`fun` takes the function and a type and returns a typed version of the supplied function.

There are no corresponding operators for native data types like `Array` or `Object`. You can create data or request it from an external source as usual, but you might have to prepare it before it passes the type validator (see line `B`):

```javascript
const append = fun(xs => ys => xs.concat(ys), "[Number] => [Number] => [Number]");

const xs = [1, 2],
  ys = ["1", 2],
  zs = [3, 4];

append(xs) (zs); // [1, 2, 3, 4]
append(ys); // type error (A)
append(ys.map(Number)) (zs); // [1, 2, 3, 4] (B)
```
As opposed to static type checking type errors are usually only thrown after a function is applied. However, frequently partial application is sufficient to trigger an error (see line `A`).

## Downside of the Type Validator Approach

The attentive reader has probably already anticipated the decisive downside of the validator approach.It is associated with the lack of type inference. There is no guarantee that an associated type matches its term:

```javascript
const length = fun(s => s.length, "Number => String"); // accepted
length("Dijkstra"); // type error
```

This is a severe downside and I do not even try to sugarcoat it. Please keep in mind that scriptum only promises _gradual_ typing. Other approaches entail different tradeoffs. I am still convinced that gradual typing is the most natural approach to type Javascript and that the advantages outweigh the disadvantages.

By the way, in most cases you can tell from the type error message if there is a mismatch between type annotation and function term. We will cover some cases in this introducation to get a better intuition for this class of type errors.

## Performance Impact and Memory Footprint

The type validator proceeds in an on-demand mode. All you need to do is to switch the `CHECK` flag:

```javascript
const CHECK = true;
```

In a common setting it is active during development stage and deactivated as soon as the code is operational. Performance penalty and memory footprint of the deactivated validator are negligible.

## Function Type

### Curried Functions

Curried functions are the first choice of the functional programmer, because they greatly simplify the function interface. Typing them with scriptum is easy:

```javascript
const add = fun(m => n => m + n, "Number => Number => Number");

add(2) (3); // 5
add("2"); // type error
```

### Imperative Functions

Javascript supports multi-argument and variadic functions as well as thunks and so does scriptum.

#### Multi-argument

While the type validator allows multi-argument functions, it is strict in the number supplied arguments:

```javascript
const add = fun((m, n) => m + n, "Number, Number => Number");

add(2, 3); // 5
add(2, "3"); // type error
add(2, 3, 4); // type error
```

#### Variadic

Variadic functions can be defined in two forms, either with a single variadic parameter or with several parameters with a closing variadic one:

```javascript
const sum = fun((...ns) => ns.reduce(n + acc, 0), "..[Number] => Number");

const showSum = fun(
  caption, (...ns) => `${caption}: ${ns.reduce(n + acc, 0)}`,
  "String, ..[Number] => String");

sum(1, 2, 3); // 6
sum(); // 0
sum(1, "2", 3); // type error
showSum("total", 1, 2, 3); // "total: 6"
```

#### Thunks

Thunks, or nullary functions are important in an eagerly evaluated language like Javascript, because it provides a means to prevent evaluation until needed:

```javascript
const lazyAdd = fun(x => y => () => x + y, "Number => Number => _ => Number");

const thunk = lazyAdd(2) (3);
thunk(); // 5
thunk(4); // type error
```

Please note that it is not permitted to pass a redundant argument to a thunk.

## Generics

scriptum excels in handling generics also known as polymorphic types:

```javascript
const comp = fun(
  f => g => x => f(g(x)),
  "(b => c) => (a => b) => a => c");

const length = fun(s => s.length, "String => Number");
const sqr = fun(n => n * n, "Number => Number");

comp(sqr) (length) ("Curie"); // 25
comp(length) (sqr); // type error
```

Let us have a closer look at what happens here. During the application of the first function argument the type variables `b` and `c` are instantiated with and substituted by the types of the supplied function, namely `Number`. The same happens when passing the second argument:

```javascript
comp(sqr) (length) ("Curie");

(b => c) => (a => b) => a => c // apply "Number => Number"
b ~ Number
c ~ Number

(a => Number) => a => Number // apply "String => Number"
a ~ String

String => Number // apply a String

Number
```

`comp` is a polymorphic type, that is it treats every value uniformly no matter of what type it is. This technique is not limited to specific types, that is the provided function can be polymorphic as well. Here is a somewhat contrived example:

```javascript
const comp = fun(
  f => g => x => f(g(x)),
  "(b => c) => (a => b) => a => c");

const id = fun(x => x, "d => d");

comp(id);

(b => c) => (a => b) => a => c // apply "d => d"
d ~ b
d ~ c
b ~ c // transitive property

(a => b) => a => b
```

scriptum goes beyond normal genrics by supporting higher-kinded and higher-rank generics. You will learn about these techniques in subsequent sections of this introduction.

## Tracking Types

Beside checking whether types and terms match a decisive task of the type validator is to assist programmers in tracking types:

```javascript
const comp = fun(
  f => g => x => f(g(x)),
  "(b => c) => (a => b) => a => c");

comp(comp) (comp), // A
comp(comp(comp)) (comp); // A
```

Without manually unifiying the types it is impossible to infer them in lines `A`. Fortunately the type validator has already done the heavy lifting. You can retrieve the current type using the `ANNO` property:

```javascript
comp(comp) (comp) [ANNO] // (b => c) => (d => a => b) => d => a => c
comp(comp(comp)) (comp) [ANNO] // (b => c) => (a => b) => (e => a) => e => c
```

From here on applying the function is easy. Let us pick the first one and see its type in motion:

```javascript
const repeat = fun(s => n => s.repeat(n), "String => Number => String");

const foldl = fun(
  f => acc => xs => xs.reduce((acc, x) => f(acc, x), acc),
  "(b, a => b) => b => [a] => b");

const add = fun((m, n) => m + n, "Number, Number => Number");

comp(comp) (comp) (repeat) [ANNO] // (d => a => Number) => d => a => String
comp(comp) (comp) (repeat) (foldl(add)) [ANNO] // Number => [Number] => String
comp(comp) (comp) (repeat) (foldl(add)) (0) [ANNO] // [Number] => String
comp(comp) (comp) (repeat) (foldl(add)) (0) ([1, 2, 3]) // "******"
```

The type validator has guided as through the application of a complex combinator. This assistance is also incredible helpful when you are in the middle of a deeply nested composite data structure.

## Structural Typing

scriptum's type validator supports structural typing along with the native `Object` type. Javascript objects are treated as an unordered map of key/value pairs. Here is a rather limited property accessor:

```javascript
const prop = fun(k => o => o[k], "{name: String, age: Number} => a");

const o1 = {name: "Fassbender", age: 43},
  o2 = {age: 43, name: "Fassbender"},
  o3 = {name: "Mulligan", age: 35, profession: "actress"};
  o4 = {name: "Tawny Port", age: 20};

prop("name") (o1); // "Fassbender"
prop("age") (o2); // 43
prop("gender") (o1); // type error
prop("name") (o3); // type error
prop("name") (o4); // "Tawny Port"
```
`prop` is not that useful for two reasons:

* it only works with a specific object type
* it still does not prevent you from invoking it with a semantically different object

The type validator comes with two extensions to address both these shortcomings.

### Combined structural/nominal typing

If we combine both typing strategies, more rigid strucural types can be obtained, which rules out the _different-semantics_ issue:

```javascript
const Actor = fun(
  function Actor(name, age) {
    this.name = name;
    this.age = age;
  },
  "String, Number => Foo {name: String, age: Number}");

const props = fun(k => o => o[k], "Actor {name: String, age: Number} => a");

const o1 = new Actor("Fassbender", 43),
  o2 = {name: "Tawny Port", age: 20};

prop("name") (o1); // Fassbender
prop("name") (o2); // type error
```

### Row Types

If we introduce a row variable that gets instantiated with the non-matching properties, a more flexible structural type can be obtained, which allows the processing of partial objects:

```javascript
const props = fun(k => o => o[k], "String => {name: String | r} => a");

const compareName = fun(
  o => p => o.name === p.name,
  "{name: String} => {name: String} => Boolean");

const o1 = {name: "Fassbender", age: 43},
  o2 = {name: "Mulligan", age: 35, profession: "actress"},
  o3 = {name: "Ernie", age: 52, pronouns: "they/them"};

prop("name") (o1); // Fassbender
prop("name") (o2); // Mulligan
compareName(o2) (o3); // type error
```

In order to understand why the third invocation is rejected by the validator, we must realize which row type `r` is instantiated with. The first argument `o1` demands `r` to be `age: Number, profession: String`. `o2`, however, expects `r` to be `age: Number, pronouns: String`, which evidently does not hold. Row types facilitate strucutal typing without giving up much type safety.

Please note that `r` and `a` from the above example might resemble each other but are nothing alike. The former is a row variable and the latter a universally quantified type variable.

### Object type concatenation

Types are encoded as first class `String`s in scriptum, i.e. you can just concatenate them with Javascript's `String` and `Array` methods. This is helpful to keep your type definitions DRY.

### Subtyping

scriptum avoids subtype polymorphism, because I do not want to mix the functional paradigm with the idea of class hierarchies. If you feel the need to rely on classes, Typescript is probably a more suitable alternative.

## `Array` Type

## Non-empty `Array` Type

## `Tuple` Type

## Built-in Primitives

### BigInt, Boolean, Number, Null and String

### `undefined`

Although `undefined` denotes a type error, Javascript silently accepts it. scriptum addresses this questionable design decision by throwing an error when a function returns a an undefined value. `undefined` arguments are legitimate though, because they allow for the necessary flexibility:

```javascript
const prop = fun(o => k => o[k], "{name: String, age: Number} => String => a"),
  o = {name: "Binoche", age: 57};

const lazyExp = fun(() => 2 * 3, "_ => Number");

prop(o) ("name"); // "Binoche"
prop(o) ("foo"); // type error

lazyExp(); // 6 (A)
```

Please note that `lazyExp()` implicitly passes `undefined` (see line `A`).

## Built-in Exotic Object Types

### `Map` type

### `Set` type

### `WeakMap` type

### `WeakSet` type

## Higher-order Generics

Higher-order generics better known as higher-kinded types allow the type constructor itself to be polymorphic. They are useful to define more general types like monoids, functors et al. Unfortunately we have yet to discuss higher-kinded types and type classes before we can encode them, hence we stick with a rather contrived example for now:

```javascript
const appendAnno = "t<a> => t<a> => t<a>";

const appendArr = fun(xs => ys => xs.concat(ys), appendAnno); // accpeted
const appendFun = fun(f => g => x => f(g(x)), appendAnno); // accpeted
const appendMap = fun(m => n => new Map([...m, ...n]), appendAnno); // accpeted
const appendNum = fun(m => n => m + n, appendAnno); // rejected
```

`appendAnno` defines a type that is polymorphic both in the type parameter `a` and in the type constructor `t`. Hence it can be applied to different value constructors, provided that their corresponding type constructors expect at least as many type parameters as `t`, namely one in the example. For this reason the last application is rejected, because Javascript's native `String` type has a nullary type constructor.

## Higher-rank Generics

### Explicit type equalaties

### Value-level type classes

### Algebraic Data types

## Algebraic Data Types

### Product types

### Sum types

### Creating nullary constructors

## Recursive Types

### Mutual recursice types

## Phantom Types

## Polymorphic Recursion
