/*
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
*/


/******************************************************************************
*******************************************************************************
*******************************[ DEPENDENCIES ]********************************
*******************************************************************************
******************************************************************************/


import {thunk} from "./lazyness.js";


import {
  ANNO,
  CHECK,
  introspectDeep,
  fun,
  TAG, type, type1, typeClass} from "./validator.js";


/* In order to render asynchronous computations stack safe the stack must be
reset periodically. In Javascript this is possible by awaiting the next micro
task using the `Promise.resolve` method. Deferring the computation to the next
micro task is by design a rather slow operation, hence it should only be
carried out when a certain treshold is exceeded. */

const MICROTASK_TRESHOLD = 0.01;


export const LT = -1;
export const EQ = 0;
export const GT = 1;


/******************************************************************************
*******************************************************************************
*******************************[ TYPE CLASSES ]********************************
*******************************************************************************
******************************************************************************/


/***[ Functor ]***************************************************************/


export const Functor = typeClass(`(^a, b. {
  map: ((a => b) => f<a> => f<b>)
}) => Functor<f>`);


/***[ Functor :: Apply ]******************************************************/


export const Apply = typeClass(`Functor<f> => (^a, b. {
  ap: (f<(a => b)> => f<a> => f<b>)
}) => Apply<f>`);


/***[ Functor :: Apply :: Applicative ]***************************************/


export const Applicative = typeClass(`Apply<f> => (^a. {
  of: (a => f<a>)
}) => Applicative<f>`);


/******************************************************************************
*******************************************************************************
***********************[ AD-HOC POLYMORPHIC FUNCTIONS ]************************
*******************************************************************************
******************************************************************************/


/***[ Functor :: Apply ]******************************************************/


export const apFst = fun(
  ({map, ap}) => tx => ty => ap(map(_const) (tx)) (ty),
  "Apply<f> => f<a> => f<b> => f<a>");


export const apSnd = fun(
  ({map, ap}) => tx => ty => ap(mapEff(map) (id) (tx)) (ty),
  "Apply<f> => f<a> => f<b> => f<b>");


export const lift2 = fun(
  ({map, ap}) => f => tx => ty => ap(map(f) (tx)) (ty),
  "Apply<f> => (a => b => c) => f<a> => f<b> => f<c>");


/******************************************************************************
*******************************************************************************
***********************************[ TYPES ]***********************************
*******************************************************************************
******************************************************************************/


/******************************************************************************
*********************************[ FUNCTION ]**********************************
******************************************************************************/


/***[ Category ]**************************************************************/


export const comp = fun(
  f => g => x => f(g(x)),
  "(b => c) => (a => b) => a => c");


export const id = fun(x => x, "a => a");


/***[ Impure ]****************************************************************/


export const _throw = fun(
  e => {throw e},
  "e => exception");


/***[ Misc. ]*****************************************************************/


export const cat = fun(
  (...lines) => lines.join(""),
  "..[String] => String");


export const _const = fun(
  x => y => x,
  "a => discard => a");


/* Supply local bindings. Combinator itself is not typed, because it allows a
heterogeneous list of arguments. It ensures that the passed function is typed
though. */

export const _let = (...args) => {
  return {in: f => {
    if (CHECK && !(ANNO in f))
      throw new TypeError(cat(
        "typed lambda expected\n",
        `but "${f.toString()}" received\n`));

    else return f(...args);
  }};
};


/******************************************************************************
**********************************[ Mutable ]**********************************
******************************************************************************/


/* `Mutable` is an imperative data type that takes a mutable type and provides
an API for safe in-place updates by avoiding to share the effect. */


export const Mutable = fun(
  clone => ref => {
    const anno = CHECK ? introspectDeep({charCode: 97}) (ref) : "";

    return _let({}, ref).in(fun((o, ref) => {
      let mutated = false;

      o.consume = thunk(() => {
        if (mutated) {
          delete o.update;

          o.update = _ => {
            throw new TypeError(
              "illegal in-place update of consumed data structure");
          };
        }

        return ref;
      }, `() => ${anno}`);

      o.update = fun(k => {
        if (!mutated) {
          ref = clone(ref); // copy once on first write
          mutated = true;
        }

        k(ref); // use the effect but discard the result
        return o;
      }, `(${anno} => ${anno}) => Mutable {consume: ${anno}, update: ((${anno} => ${anno}) => this*)}`);

      return (o[TAG] = "Mutable", o);
    }, `{}, ${anno} => Mutable {consume: ${anno}, update: ((${anno} => ${anno}) => this*)}`));
  },
  "(t<a> => t<a>) => t<a> => Mutable {consume: t<a>, update: ((t<a> => t<a>) => this*)}");


/******************************************************************************
***********************************[ ARRAY ]***********************************
******************************************************************************/


/* scriptum treats `Array` as a mutable data type, because it is designed as
such. You should only use it if you want to perform a lot of element lookups
and don't need to alter a once created array. */


export const A = {}; // namespace


/***[ Foldable ]**************************************************************/


A.foldl = fun(
  f => init => xs => {
    let acc = init;

    for (let i = 0; i < xs.length; i++)
      acc = f(acc) (xs[i]);

    return acc;
  },
  "(b => a => b) => b => [a] => b");


/***[ Functor ]***************************************************************/


A.map = fun(
  f => xs => xs.map(x => f(x)),
  "(a => b) => [a] => [b]");


A.Functor = Functor({map: A.map});


/***[ Functor :: Apply ]******************************************************/


A.ap = fun(
  fs => xs => A.foldl(fun(
    acc => f => A.append(acc) (A.map(f) (xs)),
    "[b] => (a => b) => [b]")) ([]) (fs),
  "[(a => b)] => [a] => [b]");


A.Apply = Apply(A.Functor) ({ap: A.ap});


/******************************************************************************
*********************************[ COYONEDA ]**********************************
******************************************************************************/


export const Coyoneda = type1(
  "(^r. (^b. (b => a) => f<b> => r) => r) => Coyoneda<f, a>");


export const coyoneda = fun(
  f => tx => Coyoneda(k => k(f) (tx)),
  "(b => a) => f<b> => Coyoneda<f, a>");


/***[ Con-/Destruction ]******************************************************/


// f<a> => Coyoneda<f, a>

Coyoneda.lift = coyoneda(id);


Coyoneda.lower = fun(
  ({map}) => tx => tx.run(fun(
    f => ty => map(f) (ty),
    "(b => a) => f<b> => f<a>")),
  "Functor<f> => Coyoneda<f, a> => f<a>");


/***[ Functor ]***************************************************************/

/*
instance Functor (Coyoneda f) where
  fmap f (Coyoneda g v) = Coyoneda (f . g) v
*/

Coyoneda.map = fun(
  f => tx => tx.run(fun(
    g => ty => coyoneda(fun(x => f(g(x)), "a => b")) (ty),
    "(a => b) => f<a> => Coyoneda<f, b>")),
  "(a => b) => Coyoneda<f, a> => Coyoneda<f, b>");


Coyoneda.Functor = Functor({map: Coyoneda.map});


/***[ Functor :: Apply ]******************************************************/


/*
instance Apply f => Apply (Coyoneda f) where
  Coyoneda tf tx <.> Coyoneda tg ty =
    liftCoyoneda $ (\h tz -> tf h (tg tz)) <$> tx <.> ty
*/

/*Coyoneda.ap = fun(
  ({map, ap}) => tf => tg => tf.run(fun(
    f => tx => tg.run(fun(
      g => ty => Coyoneda.lift(fun(
        h => tz => ap(map(f(h) (g(tz))) (tx)) (ty)),
        "")),
      "")),
    "(a => b) => f<b>"),
  "Apply<f> => Coyoneda<f, (a => b)> => Coyoneda<f, a> => Coyoneda<f, b>");*/


/***[ Functor :: Apply :: Applicative ]***************************************/


/******************************************************************************
**********************************[ EITHER ]***********************************
******************************************************************************/


export const Either = type(
  "(^r. {left: (a => r), right: (b => r)} => r) => Either<a, b>");


Either.Left = fun(
  x => Either(({left, right}) => left(x)),
  "a => Either<a, b>");


Either.Right = fun(
  x => Either(({left, right}) => right(x)),
  "b => Either<a, b>");


/******************************************************************************
**********************************[ YONEDA ]***********************************
******************************************************************************/


/* Enables dynamic loop fusion based on a functor that is known right from the
start, i.e. before you lift its type into `Yoneda`. Loop fusion is accomplished
by function composition. */


export const Yoneda = type1("(^b. (a => b) => f<b>) => Yoneda<f, a>");


/***[ Con-/Destruction ]******************************************************/


Yoneda.lift = fun(
  ({map}) => tx => Yoneda(
    f => map(f) (tx)),
  "Functor<f> => f<a> => Yoneda<f, a>");


Yoneda.lower = fun(
  tx => tx.run(id),
  "Yoneda<f, a> => f<a>");


/***[ Functor ]***************************************************************/

/*
instance Functor (Yoneda f) where
  fmap f m = Yoneda (\k -> runYoneda m (k . f))
*/

Yoneda.map = fun(
  f => tx => Yoneda(
    g => tx.run(
      fun(x => g(f(x)), "a => b"))),
  "(a => b) => Yoneda<f, a> => Yoneda<f, b>");


Yoneda.Functor = Functor({map: Yoneda.map});


/***[ Functor :: Apply ]******************************************************/


Yoneda.ap = fun(
  ({ap}) => tf => th => Yoneda(
    g => tf.run(fun(
      f => th.run(fun(
        h => ap(f(comp(g))) (h(id)),
        "a => b")),
      "(a => b) => f<b>"))),
  "Apply<f> => Yoneda<f, (a => b)> => Yoneda<f, a> => Yoneda<f, b>");


Yoneda.Apply = apply =>
  Apply(Yoneda.Functor) ({ap: Yoneda.ap(apply)});


/***[ Functor :: Apply :: Applicative ]***************************************/


Yoneda.of = fun(
  ({of}) => x => Yoneda(f => of(f(x))),
  "Applicative<f> => a => Yoneda<f, a>");


Yoneda.Applicative = applicative =>
  Applicative(Yoneda.Apply) ({of: Yoneda.of(applicative)});
