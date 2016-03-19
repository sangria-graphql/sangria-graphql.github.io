---
layout: normal-page
animateHeader: false
title: Learn Sangria
---

## Overview

{% include caution.html %}

**Sangria** is a Scala [GraphQL]({{site.link.graphql}}) implementation.

Here is how you can add it to your SBT project:

```scala
libraryDependencies += "{{site.groupId}}" %% "sangria" % "{{site.version.sangria}}"
```

You can find an example application that uses akka-http with _sangria_ here:

[{{site.link.akka-http-example.github}}]({{site.link.akka-http-example.github}})

It is also available as an [Activator template]({{site.link.akka-http-example.activator}}).

I would also would recommend you to check out [{{site.link.try}}]({{site.link.try}}).
It is an example of GraphQL server written with Play framework and Sangria. It also serves as a playground,
where you can interactively execute GraphQL queries and play with some examples.

If you want to use sangria with react-relay framework, they you also need to include [sangria-relay]({{site.link.repo.sangria-relay}}):

```scala
libraryDependencies += "{{site.groupId}}" %% "sangria-relay" % "{{site.version.sangria-relay}}"
```

## Query Parser and Renderer

Example usage:

```scala
import sangria.ast.Document
import sangria.parser.QueryParser
import sangria.renderer.QueryRenderer

import scala.util.Success

val query =
  """
    query FetchLukeAndLeiaAliased(
          $someVar: Int = 1.23
          $anotherVar: Int = 123) @include(if: true) {
      luke: human(id: "1000")@include(if: true){
        friends(sort: NAME)
      }

      leia: human(id: "10103\n \u00F6 ö") {
        name
      }

      ... on User {
        birth{day}
      }

      ...Foo
    }

    fragment Foo on User @foo(bar: 1) {
      baz
    }
  """

// Parse GraphQl query
val Success(document: Document) = QueryParser.parse(query)

// Pretty rendering of GraphQl query as a `String`
println(QueryRenderer.render(document))

// Compact rendering of GraphQl query as a `String`
println(QueryRenderer.render(document, QueryRenderer.Compact))
```

Alternatively you can use `graphql` macro, which will ensure that you query is syntactically correct at compile time:

```scala
import sangria.macros._

val queryAst: Document =
  graphql"""
    {
      name
      friends {
        id
        name
      }
    }
  """
```

## Schema Definition

Here is an example of GraphQL schema DSL:

```scala
import sangria.schema._

val EpisodeEnum = EnumType(
  "Episode",
  Some("One of the films in the Star Wars Trilogy"),
  List(
    EnumValue("NEWHOPE",
      value = TestData.Episode.NEWHOPE,
      description = Some("Released in 1977.")),
    EnumValue("EMPIRE",
      value = TestData.Episode.EMPIRE,
      description = Some("Released in 1980.")),
    EnumValue("JEDI",
      value = TestData.Episode.JEDI,
      description = Some("Released in 1983."))))

val Character: InterfaceType[Unit, TestData.Character] =
  InterfaceType(
    "Character",
    "A character in the Star Wars Trilogy",
    () => fields[Unit, TestData.Character](
      Field("id", StringType,
        Some("The id of the character."),
        resolve = _.value.id),
      Field("name", OptionType(StringType),
        Some("The name of the character."),
        resolve = _.value.name),
      Field("friends", OptionType(ListType(OptionType(Character))),
        Some("The friends of the character, or an empty list if they have none."),
        resolve = ctx => DeferFriends(ctx.value.friends)),
      Field("appearsIn", OptionType(ListType(OptionType(EpisodeEnum))),
        Some("Which movies they appear in."),
        resolve = _.value.appearsIn map (e => Some(e)))
    ))

val Human =
  ObjectType(
    "Human",
    "A humanoid creature in the Star Wars universe.",
    interfaces[Unit, Human](Character),
    fields[Unit, Human](
      Field("id", StringType,
        Some("The id of the human."),
        resolve = _.value.id),
      Field("name", OptionType(StringType),
        Some("The name of the human."),
        resolve = _.value.name),
      Field("friends", OptionType(ListType(OptionType(Character))),
        Some("The friends of the human, or an empty list if they have none."),
        resolve = (ctx) => DeferFriends(ctx.value.friends)),
      Field("appearsIn", OptionType(ListType(OptionType(EpisodeEnum))),
        Some("Which movies they appear in."),
        resolve = _.value.appearsIn map (e => Some(e))),
      Field("homePlanet", OptionType(StringType),
        Some("The home planet of the human, or null if unknown."),
        resolve = _.value.homePlanet)
    ))

val Droid = ObjectType(
  "Droid",
  "A mechanical creature in the Star Wars universe.",
  interfaces[Unit, Droid](Character),
  fields[Unit, Droid](
    Field("id", StringType,
      Some("The id of the droid."),
      tags = ProjectionName("_id") :: Nil,
      resolve = _.value.id),
    Field("name", OptionType(StringType),
      Some("The name of the droid."),
      resolve = ctx => Future.successful(ctx.value.name)),
    Field("friends", OptionType(ListType(OptionType(Character))),
      Some("The friends of the droid, or an empty list if they have none."),
      resolve = ctx => DeferFriends(ctx.value.friends)),
    Field("appearsIn", OptionType(ListType(OptionType(EpisodeEnum))),
      Some("Which movies they appear in."),
      resolve = _.value.appearsIn map (e => Some(e))),
    Field("primaryFunction", OptionType(StringType),
      Some("The primary function of the droid."),
      resolve = _.value.primaryFunction)
  ))

val ID = Argument("id", StringType, description = "id of the character")

val EpisodeArg = Argument("episode", OptionInputType(EpisodeEnum),
  description = "If omitted, returns the hero of the whole saga. If provided, returns the hero of that particular episode.")

val Query = ObjectType[CharacterRepo, Unit](
  "Query", fields[CharacterRepo, Unit](
    Field("hero", Character,
      arguments = EpisodeArg :: Nil,
      resolve = (ctx) => ctx.ctx.getHero(ctx.argOpt(EpisodeArg))),
    Field("human", OptionType(Human),
      arguments = ID :: Nil,
      resolve = ctx => ctx.ctx.getHuman(ctx arg ID)),
    Field("droid", Droid,
      arguments = ID :: Nil,
      resolve = Projector((ctx, f) => ctx.ctx.getDroid(ctx arg ID).get))
  ))

val StarWarsSchema = Schema(Query)
```

### Actions

`resolve` argument of a `Field` expects a function of type `Context[Ctx, Val] => Action[Ctx, Res]`. As you can see, the result of the `resolve` is `Action` type
which can take different shapes. Here is the list of supported actions:

* `Value` - a simple value result. If you want to indicate an error, you need throw an exception
* `TryValue` - a `scala.util.Try` result
* `FutureValue` - a `Future` result
* `DeferredValue` - used to return a `Deferred` result (see [Deferred Values and Resolver](#deferred-values-and-resolver) section for more details)
* `DeferredFutureValue` - the same as `DeferredValue` but allows to return `Deferred` inside of a `Future`
* `UpdateCtx` - allows you to transform `Ctx` object. The transformed context object wold be available for nested sub-objects and subsequent sibling fields in case of mutation (since execution of mutation queries is strictly sequential). You can find an example of it's usage in [Authentication and Authorisation](#authentication-and-authorisation) section

Normally library is able to automatically infer the `Action` type, so that you don't need to specify it explicitly.

### Deferred Values and Resolver

In the example schema, you probably noticed, that some of the resolve functions return `DeferFriends`. It is defined like this:

```scala
case class DeferFriends(friends: List[String]) extends Deferred[List[Character]]
```

Defer mechanism allows you to postpone the execution of particular fields and then batch them together in order to optimise object retrieval.
This can be very useful when you are trying N+1. In this example all of the characters have list of friends, but they only have IDs of them.
You need to fetch from somewhere in order to progress query execution.
Retrieving evey friend one-by-one would be inefficient, since you potentially need to access an external database
in order to do so. Defer mechanism allows you to batch all these friend list retrieval requests in one efficient request to the DB. In order to do it,
you need to implement a `DeferredResolver`, that will get a list of deferred values:

```scala
class FriendsResolver extends DeferredResolver[Any] {
  def resolve(deferred: List[Deferred[Any]], ctx: Any): List[Future[Any]] =
    // your bulk friends retrieving logic
}
```

### Projections

Sangria also introduces the concept of projections. If you are fetching your data from the database (like let's say MongoDB), then it can be
very helpful to know which fields are needed for the query ahead-of-time in order to make efficient projection in the DB query.

`Projector` allows you to do precisely this. It wraps a `resolve` function and enhances it
with the list of projected fields (limited by depth). `ProjectionName` field tag allows you to customise projected
field name (this is helpful, if your DB field names are different from the GraphQL field names).
`ProjectionExclude` field tag on the other hand allows you to exclude a field from the list of projected field names.

### Input and Context Objects

Many schema elements, like `ObjectType`, `Field` or `Schema` itself, take two type parameters: `Ctx` and `Val`:

* `Val` - represent values that are returned by `resolve` function and given to resolve function as a part of the `Context`. In the schema example,
  `Val` can be a `Human`, `Droid`, `String`, etc.
* `Ctx` - represents some contextual object that flows across the whole execution (and doesn't change in most of the cases). It can be provided to execution by the user
  in order to help fulfill the GraphQL query. A typical example of such context object is as service or repository object that is able to access
  a Database. In example schema some of the fields, like `droid` or `human` make use of it in order to access the character repository.

### Providing Additional Types

After schema is defined, library tries to discover all of the supported GraphQL types by traversing the schema. Sometimes you have a situation, where not all
GraphQL types are explicitly reachable from the root of the schema. For instance, if the example schema had only the `hero` field in the `Query` type, then
it would not be possible to automatically discover the `Human` and the `Droid` type, since only the `Character` interface type is referenced inside of the schema.

If you have similar situation, then you need to provide additional types like this:

```scala
val HeroOnlyQuery = ObjectType[CharacterRepo, Unit](
  "HeroOnlyQuery", fields[CharacterRepo, Unit](
    Field("hero", TestSchema.Character,
      arguments = TestSchema.EpisodeArg :: Nil,
      resolve = (ctx) => ctx.ctx.getHero(ctx.argOpt(TestSchema.EpisodeArg)))
  ))

val heroOnlySchema = Schema(HeroOnlyQuery, additionalTypes = TestSchema.Human :: TestSchema.Droid :: Nil)
```

Alternatively you can use `manualPossibleTypes` on the `Field` and `InterfaceType` to achieve the same effect.

### Circular References and Recursive Types

In some cases you need to define a GraphQL schema that contains recursive types or has circular references in the object graph. Sangria supports such schemas
by allowing you to provide a no-arg function that crates `ObjectType` fields instead of eager list of fields. Here is an example of interdependent types:

```scala
case class A(b: Option[B], name: String)
case class B(a: A, size: Int)

lazy val AType: ObjectType[Unit, A] = ObjectType("A", () => fields[Unit, A](
  Field("name", StringType, resolve = _.value.name),
  Field("b", OptionType(BType), resolve = _.value.b)))

lazy val BType: ObjectType[Unit, B] = ObjectType("B", () => fields[Unit, B](
  Field("size", IntType, resolve = _.value.size),
  Field("a", AType, resolve = _.value.a)))
```

In most cases you also need to define (at least one of) these types with `lazy val`.

## Query Execution

Here is an example of how you can execute example schema:

```scala
import sangria.execution.Executor

Executor(TestSchema.StarWarsSchema, userContext = new CharacterRepo, deferredResolver = new FriendsResolver)
  .execute(queryAst, variables = vars)
```

The result of the execution is a `Future` of marshaled GraphQL result (see next section)

## Protection Against Malicious Queries

GraphQL is very flexible data query language. Unfortunately with flexibility comes also a danger of misuse by malicious clients.
Since typical GraphQL schemas contain recursive types and circular dependencies, clients are able to send infinitely deep queries
which may have high impact on server performance. That's because it's important to analyze query complexity before exciting it.
Sangria provides two mechanisms to protect your GraphQL server from malicious or too expensive queries which are described in the next sections.

### Query Complexity Analysis

Query complexity analysis makes a rough estimation of the query complexity before it is executed. The complexity is `Double` number that is
calculated according to the simple rule described below.

Every field in the query gets a default score `1` (including `ObjectType` nodes). The "complexity" of the query is the sum of all field scores.

so for instance query:

```js
query Test {
  droid(id: "1000") {
    id
    serialNumber
  }

  pets(limit: 20) {
    name
    age
  }
}
```

will have complexity `6`. You probably noticed, that score is a bit unfair since `pets` field is actually a list which can contain max 20
elements in the reponse.

You can customize the field score with `complexity` argument in order to solve this kind of issues:

```scala
Field("pets", OptionType(ListType(PetType)),
  arguments = Argument("limit", IntType) :: Nil,
  complexity = Some((ctx, args, childScore) ⇒ 25.0D + args.arg[Int]("limit") * childScore),
  resolve = ctx ⇒ ...)
```

Now query will get score `68` which is much better estimation.

In order to analyze the complexity of a query you need to add correspondent a `QueryReducer` to the `Executor`.
In this example `rejectComplexQueries` will reject all queries with complexity higher than `1000`:

```scala
val rejectComplexQueries = QueryReducer.rejectComplexQueries[Any](1000, (c, ctx) ⇒
    new IllegalArgumentException(s"Too complex query: max allowed complexity is 1000.0, but got $c"))

val exceptionHandler: PartialFunction[(ResultMarshaller, Throwable), HandledException] = {
  case (m, e: IllegalArgumentException) ⇒ HandledException(e.getMessage)
}

Executor.execute(schema, query,
    exceptionHandler = exceptionHandler,
    queryReducers = rejectComplexQueries :: Nil)
```

If you just want to estimate the complexity and then perform different kind of action, then there is another helper function for this:

```scala
val complReducer = QueryReducer.measureComplexity[MyCtx] { (c, ctx) ⇒
  // do some analysis
  ctx
}
```

The complexity of full introspection query (used by tools like GraphiQL) is around `100`.

### Limiting Query Depth

There is also another simpler mechanism to protect against malicious queries: limiting query depth. It can be done by providing
the `maxQueryDepth` argument to the `Executor`:

```scala
val executor = Executor(schema = MySchema, maxQueryDepth = Some(7))
```

## Error Handling

When some unexpected error happens in `resolve` function, sangria handles it according to the [rules defined in the spec]({{site.link.spec.errors}}).
If an exception implements `UserFacingError` trait, then error message would be visible in the response. Otherwise error message is obfuscated and response will contain `"Internal server error"`.

In order to define custom error handling mechanism, you need to provide an `exceptionHandler` to `Executor`. Here is an example:

```scala
val exceptionHandler: PartialFunction[(ResultMarshaller, Throwable), HandledException] = {
  case (m, e: IllegalStateException) => HandledException(e.getMessage)
}

Executor(schema, exceptionHandler = exceptionHandler).execute(doc)
```

In this example it provides an error `message` (which would be shown instead of "Internal server error").

You can also add additional fields in the error object like this:

```scala
val exceptionHandler: PartialFunction[(ResultMarshaller, Throwable), HandledException] = {
  case (m, e: IllegalStateException) =>
    HandledException(e.getMessage,
      Map("foo" -> m.arrayNode(Seq(m.stringNode("bar"), m.intNode(1234))), "baz" -> m.stringNode("Test")))
}
```

## Result Marshalling and Input Unmarshalling

GraphQL query execution needs to know how to serialize the result of execution and how to deserialize arguments/variables.
Specification itself does not define the data format, instead it uses abstract concepts like map and list.
Sangria does not hard-code the serialisation mechanism. Instead it provides two traits for this:

* `ResultMarshaller` - knows how to serialize results of execution
* `InputUnmarshaller[Node]` - knows how to deserialize the arguments/variables

At the moment Sangria provides implementations fro these libraries:

* The default one, which serializes/deserializes to scala `Map`/`List`
* `sangria.marshalling.queryAst._` - native Query Value AST serialization/deserialization
* `sangria.marshalling.sprayJson._` - spray-json serialization/deserialization 
  * extra dependency `"{{site.groupId}}" %% "sangria-spray-json" % "{{site.version.sangria-spray-json}}"`
* `sangria.marshalling.playJson._` - play-json serialization/deserialization 
  * extra dependency `"{{site.groupId}}" %% "sangria-play-json" % "{{site.version.sangria-play-json}}"`
* `sangria.marshalling.circe._` - circe serialization/deserialization 
  * extra dependency `"{{site.groupId}}" %% "sangria-circe" % "{{site.version.sangria-circe}}"`
* `sangria.marshalling.argonaut._` - argonaut serialization/deserialization 
  * extra dependency `"{{site.groupId}}" %% "sangria-argonaut" % "{{site.version.sangria-argonaut}}"`
* `sangria.marshalling.json4s.native._` - json4s-native serialization/deserialization 
  * extra dependency `"{{site.groupId}}" %% "sangria-json4s-native" % "{{site.version.sangria-json4s-native}}"`
* `sangria.marshalling.json4s.jackson._` - json4s-jackson serialization/deserialization
  * extra dependency `"{{site.groupId}}" %% "sangria-json4s-jackson" % "{{site.version.sangria-json4s-jackson}}"`
* `sangria.marshalling.msgpack._` - [MessagePack](http://msgpack.org/) serialization/deserialization
  * extra dependency `"{{site.groupId}}" %% "sangria-msgpack" % "{{site.version.sangria-msgpack}}"`  
  
In order to use one of these, just import it and the result of execution will be of the correct type:

```scala
import sangria.marshalling.sprayJson._

println(Await.result(
  Executor.execute(TestSchema.StarWarsSchema, queryAst,
    variables = vars
    userContext = new CharacterRepo, 
    deferredResolver = new FriendsResolver), Duration.Inf).prettyPrint)
```

## Middleware

Sangria support generic middleware that can be used for different purposes, like performance measurement, metrics collection, security enforcement, etc. on a field and query level.
Moreover it makes it much easier for people to share standard middleware in a libraries. Middleware allows you to define callbacks before/after query and field.

Here is a small example of it's usage:

```scala
class FieldMetrics extends Middleware[Any] with MiddlewareAfterField[Any] with MiddlewareErrorField[Any] {
  type QueryVal = MutableMap[String, List[Long]]
  type FieldVal = Long

  def beforeQuery(context: MiddlewareQueryContext[Any, _, _]) = MutableMap()
  def afterQuery(queryVal: QueryVal, context: MiddlewareQueryContext[Any, _, _]) =
    reportQueryMetrics(queryVal)

  def beforeField(queryVal: QueryVal, mctx: MiddlewareQueryContext[Any, _, _], ctx: Context[Any, _]) =
    continue(System.currentTimeMillis())

  def afterField(queryVal: QueryVal, fieldVal: FieldVal, value: Any, mctx: MiddlewareQueryContext[Any, _, _], ctx: Context[Any, _]) = {
    val key = ctx.parentType.name + "." + ctx.field.name
    val list = queryVal.getOrElse(key, Nil)

    queryVal.update(key, list :+ (System.currentTimeMillis() - fieldVal))
    None
  }

  def fieldError(queryVal: QueryVal, fieldVal: FieldVal, error: Throwable, mctx: MiddlewareQueryContext[Any, _, _], ctx: Context[Any, _]) = {
    val key = ctx.parentType.name + "." + ctx.field.name
    val list = queryVal.getOrElse(key, Nil)
    val errors = queryVal.getOrElse("ERROR", Nil)

    queryVal.update(key, list :+ (System.currentTimeMillis() - fieldVal))
    queryVal.update("ERROR", errors :+ 1L)
  }
}

val result = Executor.execute(schema, query, middleware = new FieldMetrics :: Nil)
```

It will record execution time of all fields in a query and then report it in some way.

`afterField` also allows you to transform field value by returning `Some` with a transformed value. You can also throw an exception from `beforeField` or `afterField`
in order to indicate a field error.

In order to ensure generic classification of fields, every field contains a generic list or `FieldTag`s which provides a user-defined
meta-information about this field (just to highlight a few examples: `Permission("ViewOrders")`, `Authorized`, `Measured`, `Cached`, etc.).
You can find another example of `FieldTag` and `Middleware` usage in [Authentication and Authorisation](#authentication-and-authorisation) section.

## Query Reducers

Sometimes in can be helpful to perform some analysis on a query before executing it. An example is complexity analysis: it aggregates the complexity
of all fields in the query and then rejects the query without executing it if complexity is too high. Another example is gathering all `Permission`
field tags and then fetching extra user auth data from external service if query contains protected fields. This need to be done before query
started to execute.

Sangria provides a mechanism for this kind of query analysis with `QueryReducer`. Query reducer implementation will go through all of the fields
in the query and aggregate them to a single value. `Executor` will then call `reduceCtx` with this aggregated value which gives you an
opportunity to perform some logic and update the `Ctx` before query is executed.

Out-of-the-box sangria comes with several `QueryReducer`s for common use-cases:

* `QueryReducer.measureComplexity` - measures a complexity of the query
* `QueryReducer.rejectComplexQueries` - rejects queries with complexity above provided threshold
* `QueryReducer.collectTags` - collects `FieldTag`s based on partial function

Here is a small example of `QueryReducer.collectTags`:

```scala
val fetchUserProfile = QueryReducer.collectTags[MyContext, String] {
  case Permission(name) ⇒ name
} { (permissionNames, ctx) ⇒
  if (permissionNames.nonEmpty) {
    val userProfile: Future[UserProfile] = externalService.getUserProfile()

    userProfile.map(profile ⇒ ctx.copy(profile = Some(profile))
  } else
    ctx
}

Executor.execute(schema, query,
  userContext = new MyContext,
  queryReducers = fetchUserProfile :: Nil)
```

This allows you to avoid fetching user profile if it's not needed based on the query fields. You can find more information about the `QueryReducer`
that analyses a query complexity in the [Query Complexity Analysis](#query-complexity-analysis) section.

## Built-in Scalars

Sangria support all standard GraphQL scalars like `String`, `Int`, `ID`, etc. In addition, sangria introduces following built-in scalar types:

* `Long` - a 64 bit integer value which is represented as a `Long` in scala code
* `BigInt` - similar to `Int` scalar value, but allows you to transfer big integer values and represents them in code as scala's `BigInt` class
* `BigDecimal` - similar to `Float` scalar value, but allows you to transfer big decimal values and represents them in code as scala's `BigDecimal` class

## Deprecation Tracking

GraphQL schema allows you to declare fields and enum values as deprecated. When you execute a query, you can provide your custom implementation of
`DeprecationTracker` trait to the `Executor` in order to track deprecated fields and enum values (you can, for instance, log all usages or send metrics to graphite):

```scala
trait DeprecationTracker {
  def deprecatedFieldUsed[Ctx](ctx: Context[Ctx, _]): Unit
  def deprecatedEnumValueUsed[T, Ctx](enum: EnumType[T], value: T, userContext: Ctx): Unit
}
```

## Authentication and Authorisation

Even though sangria does not provide security primitives explicitly, it's pretty straightforward to implement it in different ways. It's pretty common
requirement of modern web-application so this section was written to demonstrate several possible approaches of handling authentication and authorisation.

First let's define some basic infrastructure for this example:

```scala
case class User(userName: String, permissions: List[String])

trait UserRepo {
  /** Gives back a token or sessionId or anything else that identifies the user session  */
  def authenticate(userName: String, password: String): Option[String]

  /** Gives `User` object with his/her permissions */
  def authorise(token: String): Option[User]
}

class ColorRepo {
  def colors: List[String]
  def addColor(color: String): Unit
}
```

In order to indicate an auth error, we need to define some exception:

```scala
case class AuthenticationException(message: String) extends Exception(message)
case class AuthorisationException(message: String) extends Exception(message)
```

We also want user to see proper error messages in a response, so let's define an error handler for this:

```scala
val errorHandler: PartialFunction[(ResultMarshaller, Throwable), HandledException] = {
  case (m, AuthenticationException(message)) => HandledException(message)
  case (m, AuthorisationException(message)) => HandledException(message)
}
```

Now that we defined base for secure application, let's create a context class, which will provide GraphQL schema with all necessary helper functions:

```scala
case class SecureContext(token: Option[String], userRepo: UserRepo, colorRepo: ColorRepo) {
  def login(userName: String, password: String) = userRepo.authenticate(userName, password) getOrElse (
      throw new AuthenticationException("UserName or password is incorrect"))

  def authorised[T](permissions: String*)(fn: User => T) =
    token.flatMap(userRepo.authorise).fold(throw AuthorisationException("Invalid token")) { user =>
      if (permissions.forall(user.permissions.contains)) fn(user)
      else throw AuthorisationException("You do not have permission to do this operation")
    }

  def ensurePermissions(permissions: List[String]): Unit =
    token.flatMap(userRepo.authorise).fold(throw AuthorisationException("Invalid token")) { user =>
      if (!permissions.forall(user.permissions.contains))
        throw AuthorisationException("You do not have permission to do this operation")
    }

  def user = token.flatMap(userRepo.authorise).fold(throw AuthorisationException("Invalid token"))(identity)
}
```

Now we should be able to execute queries:

```scala
Executor.execute(schema, queryAst,
  userContext = new SecureContext(token, userRepo, colorRepo),
  exceptionHandler = errorHandler)
```

As a last step we need to define a schema. You can do it in two different ways:

* Auth can be enforced in the `resolve` function itself
* You can use `Middleware` and `FieldTag`s to ensure that user has permissions to access fields

### Resolve-Based Auth

```scala
val UserNameArg = Argument("userName", StringType)
val PasswordArg = Argument("password", StringType)
val ColorArg = Argument("color", StringType)

val UserType = ObjectType("User", fields[SecureContext, User](
  Field("userName", StringType, resolve = _.value.userName),
  Field("permissions", OptionType(ListType(StringType)),
    resolve = ctx => ctx.ctx.authorised("VIEW_PERMISSIONS") { _ =>
      ctx.value.permissions
    })
))

val QueryType = ObjectType("Query", fields[SecureContext, Unit](
  Field("me", OptionType(UserType), resolve = ctx => ctx.ctx.authorised()(user => user)),
  Field("colors", OptionType(ListType(StringType)),
    resolve = ctx => ctx.ctx.authorised("VIEW_COLORS") { _ =>
      ctx.ctx.colorRepo.colors
    })
))

val MutationType = ObjectType("Mutation", fields[SecureContext, Unit](
  Field("login", OptionType(StringType),
    arguments = UserNameArg :: PasswordArg :: Nil,
    resolve = ctx => UpdateCtx(ctx.ctx.login(ctx.arg(UserNameArg), ctx.arg(PasswordArg))) { token =>
      ctx.ctx.copy(token = Some(token))
    }),
  Field("addColor", OptionType(ListType(StringType)),
    arguments = ColorArg :: Nil,
    resolve = ctx => ctx.ctx.authorised("EDIT_COLORS") { _ =>
      ctx.ctx.colorRepo.addColor(ctx.arg(ColorArg))
      ctx.ctx.colorRepo.colors
    })
))

def schema = Schema(QueryType, Some(MutationType))
```

As you can see on this example, we are using context object to authorise user with the `authorised` function. Interesting thing to notice
here is that `login` field uses `UpdateCtx` action in order make login information available for sibling mutation fields. This makes queries
like this possible:

```js
mutation LoginAndMutate {
  login(userName: "admin", password: "secret")

  withMagenta: addColor(color: "magenta")
  withOrange: addColor(color: "orange")
}
```

here we login and adding colors in the same GraphQL query. It will produce result like this one:

```json
{
  "data":{
   "login":"a4d7fc91-e490-446e-9d4c-90b5bb22e51d",
   "withMagenta":["red","green","blue","magenta"],
   "withOrange":["red","green","blue","magenta","orange"]
  }
}
```

If user does not have sufficient permissions, he will see result like this:

```json
{
  "data":{
    "me":{
      "userName":"john",
      "permissions":null
    },
    "colors":["red","green","blue"]
  },
  "errors":[{
    "message":"You do not have permission to do this operation",
    "field":"me.permissions",
    "locations":[{
      "line":3,
      "column":25
    }]
  }]
}
```

### Middleware-Based Auth

An alternative approach is to use middleware. This can provide more declarative way to define field permissions.

First let's define `FieldTag`s:

```scala
case object Authorised extends FieldTag
case class Permission(name: String) extends FieldTag
```

This allows us to define schema like this:

```scala
val UserType = ObjectType("User", fields[SecureContext, User](
  Field("userName", StringType, resolve = _.value.userName),
  Field("permissions", OptionType(ListType(StringType)),
    tags = Permission("VIEW_PERMISSIONS") :: Nil,
    resolve = _.value.permissions)
))

val QueryType = ObjectType("Query", fields[SecureContext, Unit](
  Field("me", OptionType(UserType), tags = Authorised :: Nil,resolve = _.ctx.user),
  Field("colors", OptionType(ListType(StringType)),
    tags = Permission("VIEW_COLORS") :: Nil, resolve = _.ctx.colorRepo.colors)
))

val MutationType = ObjectType("Mutation", fields[SecureContext, Unit](
  Field("login", OptionType(StringType),
    arguments = UserNameArg :: PasswordArg :: Nil,
    resolve = ctx => UpdateCtx(ctx.ctx.login(ctx.arg(UserNameArg), ctx.arg(PasswordArg))) { token =>
      ctx.ctx.copy(token = Some(token))
    }),
  Field("addColor", OptionType(ListType(StringType)),
    arguments = ColorArg :: Nil,
    tags = Permission("EDIT_COLORS") :: Nil,
    resolve = ctx => {
      ctx.ctx.colorRepo.addColor(ctx.arg(ColorArg))
      ctx.ctx.colorRepo.colors
    })
))

def schema = Schema(QueryType, Some(MutationType))
```

As you can see, security constraints are now defined as field's `tags`. In order to enforce these security constraints we need implement `Middleware` like this:

```scala
object SecurityEnforcer extends Middleware[SecureContext] with MiddlewareBeforeField[SecureContext] {
  type QueryVal = Unit
  type FieldVal = Unit

  def beforeQuery(context: MiddlewareQueryContext[SecureContext, _, _]) = ()
  def afterQuery(queryVal: QueryVal, context: MiddlewareQueryContext[SecureContext, _, _]) = ()

  def beforeField(queryVal: QueryVal, mctx: MiddlewareQueryContext[SecureContext, _, _], ctx: Context[SecureContext, _]) = {
    val permissions = ctx.field.tags.collect {case Permission(p) => p}
    val requireAuth = ctx.field.tags contains Authorised
    val securityCtx = ctx.ctx

    if (requireAuth)
      securityCtx.user

    if (permissions.nonEmpty)
      securityCtx.ensurePermissions(permissions)

    continue
  }
}
```
