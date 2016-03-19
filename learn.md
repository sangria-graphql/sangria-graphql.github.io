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

val heroOnlySchema = Schema(HeroOnlyQuery, 
  additionalTypes = TestSchema.Human :: TestSchema.Droid :: Nil)
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

### Schema Rendering

You can render a schema or an introspection results in human-readable form (IDL syntax) with `SchemaRenderer`. Here is an example:

```scala
SchemaRenderer.renderSchema(SchemaDefinition.StarWarsSchema)
```

For a StarWars schema it will produce following results:

```
interface Character {
  id: String!
  name: String
  friends: [Character]
  appearsIn: [Episode]
}

type Droid implements Character {
  id: String!
  name: String
  friends: [Character]
  appearsIn: [Episode]
  primaryFunction: String
}

enum Episode {
  NEWHOPE
  EMPIRE
  JEDI
}

type Human implements Character {
  id: String!
  name: String
  friends: [Character]
  appearsIn: [Episode]
  homePlanet: String
}

type Query {
  hero(episode: Episode): Character!
  human(id: String!): Human
  droid(id: String!): Droid!
}
```

## Schema Materialization

If you already got an full introspection result from a server, you can recreate an in-memory representation of the schema with `IntrospectionSchemaMaterializer`. This feature has a lot of potential for clint-side tools, testing, mocking, creating proxy/facade GraphQL servers, etc.

Here is simple example of how you can use this feature (using circe in this particular example):

```scala
import io.circe._
import sangria.marshalling.circe._

val introspectionResults: Json = ??? // coming from other server or file
val clientSchema: Schema[Unit, Unit] = 
  Schema.buildFromIntrospection(introspectionResults)  
```

It takes a results of full introspection query (loaded from the server, file, etc.) and recreates the schema definition with stubs for resolve methods. You can customize a lot of aspects of materialization by providing custom `MaterializationLogic` implementation (you can also extend `DefaultMaterializationLogic` class). This means that you can, for instance, plug in some generic field resolution logic (`resolveField` method) or provide generic logic for custom scalars (`coerceScalar*` methods). Without these customisations schema only would be able to execute introspection queries. 
   
### Default Value Materialization 
   
By default, default values (for input object fields and arguments) would be ignored because it's just a string as far as introspection API is concerned. However you can enable default value support if you know the format of the default values (in many cases it would be JSON). There is even a helper function for this:
  
```scala
import spray.json._
import sangria.marshalling.sprayJson._

val clientSchema: Schema[Unit, Unit] = 
  Schema.buildFromIntrospection(introspectionResults,
    MaterializationLogic.withDefaultValues[Unit, JsValue])
```

This will inform schema materializer that default values are serialized as JSON and that spray-json should be used to work with them (please note, that circe does not have a built-in JSON parsing support, so it can't be used out-of-the-box here. On the other hand, it's pretty easy to add support for particular circe parser by defining an implicit instance of `InputParser` type class).  

## Query Execution

Here is an example of how you can execute example schema:

```scala
import sangria.execution.Executor

Executor.execute(TestSchema.StarWarsSchema, queryAst, 
  userContext = new CharacterRepo, 
  deferredResolver = new FriendsResolver, 
  variables = vars)
```

The result of the execution is a `Future` of marshaled GraphQL result (see [Result Marshalling and Input Unmarshalling](#result-marshalling-and-input-unmarshalling) section for more details)

### Prepared Queries
 
In some situations you may need to make a static query analysis and postpone the actual execution of the query. Later on you may need to execute this query several times. Typical example is subscription queries: you first validate and prepare a query, and then you execute it several times for every event. This is precisely what `PreparedQuery` allows you to do.

Let't look at the example:

```scala
val preparedQueryFuture = Executor.prepare(StarWarsSchema, query, 
  new CharacterRepo, 
  deferredResolver = new FriendsResolver)

preparedQueryFuture.map(preparedQuery ⇒ 
  preparedQuery.execute(userContext = someCustomCtx, root = event))
```

`Executor.prepare` will return you a `Future` with prepared query which you can execute several times later, possibly providing different `userContext` or `root` value. In addition to `execute`, `PreparedQuery` also gives you a lot of information about the query itself: operation, root `QueryType`, top-level fields with arguments, etc.

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

val exceptionHandler: Executor.ExceptionHandler = {
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

Bad things can happen during the query execution. When errors happen, then `Future` would be resolved with some exception. Sangria allows you to distinguish between different types of errors that happen before actual query execution:
 
* `QueryReducingError` - an error happened in the query reducer. If you are throwing some exceptions within a custom `QueryReducer`, then they would be wrapped in `QueryReducingError`    
* `QueryAnalysisError` - signifies issues in the query or variables. This means that client has made some error. If you are exposing GraphQL HTTP endpoint, than you may want to return 400 status code in this case.
* `ErrorWithResolver` - unexpected errors before query execution
  
All mentioned exception classes expose `resolveError` method which you can use to render an error in GraphQL-compliant format.

Let's see how you can handle these error in small example. In most cases it makes a lot of sense to return 400 HTTP status code if query validation failed:
    
```scala
executor.execute(query, ...)
  .map(Ok(_))
  .recover {
    case error: QueryAnalysisError ⇒ BadRequest(error.resolveError)
    case error: ErrorWithResolver ⇒ InternalServerError(error.resolveError)
  }
```

This code will produce status code 400 in case of any error caused by client (query validation, invalid operation name, error in query reducer, etc.).

### Custom ExceptionHandler

When some unexpected error happens in `resolve` function, sangria handles it according to the [rules defined in the spec]({{site.link.spec.errors}}).
If an exception implements `UserFacingError` trait, then error message would be visible in the response. Otherwise error message is obfuscated and response will contain `"Internal server error"`.

In order to define custom error handling mechanism, you need to provide an `exceptionHandler` to `Executor`. Here is an example:

```scala
val exceptionHandler: Executor.ExceptionHandler = {
  case (m, e: IllegalStateException) => HandledException(e.getMessage)
}

Executor(schema, exceptionHandler = exceptionHandler).execute(doc)
```

In this example it provides an error `message` (which would be shown instead of "Internal server error").

You can also add additional fields in the error object like this:

```scala
val exceptionHandler: Executor.ExceptionHandler = {
  case (m, e: IllegalStateException) =>
    HandledException(e.getMessage,
      Map(
      "foo" -> m.arrayNode(Seq(m.stringNode("bar"), m.intNode(1234))), 
      "baz" -> m.stringNode("Test")))
}
```

## Result Marshalling and Input Unmarshalling

GraphQL query execution needs to know how to serialize the result of execution and how to deserialize arguments/variables.
Specification itself does not define the data format, instead it uses abstract concepts like map and list.
Sangria does not hard-code the serialisation mechanism. Instead it provides two traits for this:

* `ResultMarshaller` - knows how to serialize results of execution
* `InputUnmarshaller[Node]` - knows how to deserialize the arguments/variables

At the moment Sangria provides implementations fro these libraries:

* `sangria.marshalling.queryAst._` - native Query Value AST serialization
* `sangria.marshalling.sprayJson._` - spray-json serialization 
  * `"{{site.groupId}}" %% "sangria-spray-json" % "{{site.version.sangria-spray-json}}"`
* `sangria.marshalling.playJson._` - play-json serialization 
  * `"{{site.groupId}}" %% "sangria-play-json" % "{{site.version.sangria-play-json}}"`
* `sangria.marshalling.circe._` - circe serialization 
  * `"{{site.groupId}}" %% "sangria-circe" % "{{site.version.sangria-circe}}"`
* `sangria.marshalling.argonaut._` - argonaut serialization 
  * `"{{site.groupId}}" %% "sangria-argonaut" % "{{site.version.sangria-argonaut}}"`
* `sangria.marshalling.json4s.native._` - json4s-native serialization 
  * `"{{site.groupId}}" %% "sangria-json4s-native" % "{{site.version.sangria-json4s-native}}"`
* `sangria.marshalling.json4s.jackson._` - json4s-jackson serialization
  * `"{{site.groupId}}" %% "sangria-json4s-jackson" % "{{site.version.sangria-json4s-jackson}}"`  
* `sangria.marshalling.msgpack._` - [MessagePack](http://msgpack.org/) serialization
  * `"{{site.groupId}}" %% "sangria-msgpack" % "{{site.version.sangria-msgpack}}"`   
  
In order to use one of these, just import it and the result of execution will be of the correct type:

```scala
import sangria.marshalling.sprayJson._

val result: Future[JsValue] = Executor.execute(TestSchema.StarWarsSchema, queryAst,
  variables = vars
  userContext = new CharacterRepo, 
  deferredResolver = new FriendsResolver)
```

### QueryAst Marshalling
 
A subset of GraphQL grammar that handles input object is also available as a standalone feature. You can read more about it in a following blog post:
 
[GraphQL Object Notation](https://medium.com/@oleg.ilyenko/graphql-object-notation-8f56194556ea)

Feature allows you to parse and render any `ast.Value` independently from GraphQL query. You can also use `graphqlInput` macros for this:

```scala
import sangria.renderer.QueryRenderer
import sangria.macros._
import sangria.ast

val parsed: ast.Value =
  graphqlInput"""
    {
      id: "1234345"
      version: 2 # changed 2 times
      deliveries: [
        {id: 123, received: false, note: null, state: OPEN}
      ]
    }
  """

val rendered: String =
  QueryRenderer.render(parsed, QueryRenderer.PrettyInput)

println(rendered)
```

It will produce following output:

```js
{
  id: "1234345"
  version: 2
  deliveries: [{
    id: 123
    received: false
    note: null
    state: OPEN
  }]
}
```

Proper `InputUnmarshaller` and `ResultMarshaller` are available for it, so you can use `ast.Value` as a variables or it can be a result 
of GraphQL query execution.

### Converting Between Formats

As a natural extension of `ResultMarshaller` and `InputUnmarshaller` abstractions, sangria allows you to convert between different formats at will.
 
Here is, for instance, how you can convert circe `Json` into sprayJson `JsValue`:
 
```scala
import sangria.marshalling.circe._
import sangria.marshalling.sprayJson._
import sangria.marshalling.MarshallingUtil._

val circeJson = Json.array(
  Json.empty, 
  Json.int(123), 
  Json.array(Json.obj("foo" → Json.string("bar"))))
  
val sprayJson = circeJson.convertMarshaled[JsValue]  
```

### Marshalling API & Testkit

If your favorite library is not supported yet, then it's pretty easy to create an integration library yourself. All marshalling libraries depend on and implement `sangria-marshalling-api`. You can include it together with the testkit like this:
  
```scala
libraryDependencies ++= Seq(
  "{{site.groupId}}" %% "sangria-marshalling-api" % "{{site.version.sangria-marshalling-api}}",
  "{{site.groupId}}" %% "sangria-marshalling-testkit" % "{{site.version.sangria-marshalling-testkit}}" % "test")
```

After you implemented the actual integration code, you test whether it's semantically correct with the help of a testkit. Testkit provides a set of ScalaTest-based tests to verify an implementation of marshalling library (so that you don't need to write tests yourself). Here is an example from spray-json integration library that uses a testkit tests:

```scala
class SprayJsonSupportSpec extends WordSpec 
                              with Matchers 
                              with MarshallingBehaviour 
                              with InputHandlingBehaviour 
                              with ParsingBehaviour {

  object JsonProtocol extends DefaultJsonProtocol {
    implicit val commentFormat = jsonFormat2(Comment.apply)
    implicit val articleFormat = jsonFormat4(Article.apply)
  }

  "SprayJson integration" should {
    import JsonProtocol._

    behave like `value (un)marshaller`(SprayJsonResultMarshaller)

    behave like `AST-based input unmarshaller`(sprayJsonFromInput[JsValue])
    behave like `AST-based input marshaller`(SprayJsonResultMarshaller)

    behave like `case class input unmarshaller`
    behave like `case class input marshaller`(SprayJsonResultMarshaller)

    behave like `input parser`(ParseTestSubjects(
      complex = """{"a": [null, 123, [{"foo": "bar"}]], "b": {"c": true, "d": null}}""",
      simpleString = "\"bar\"",
      simpleInt = "12345",
      simpleNull = "null",
      list = "[\"bar\", 1, null, true, [1, 2, 3]]",
      syntaxError = List("[123, FOO BAR")
    ))
  }
}
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

## Scalar Types

Sangria support all standard GraphQL scalars like `String`, `Int`, `ID`, etc. In addition, sangria introduces following built-in scalar types:

* `Long` - a 64 bit integer value which is represented as a `Long` in scala code
* `BigInt` - similar to `Int` scalar value, but allows you to transfer big integer values and represents them in code as scala's `BigInt` class
* `BigDecimal` - similar to `Float` scalar value, but allows you to transfer big decimal values and represents them in code as scala's `BigDecimal` class

### Custom Scalar Types

You can also create your own custom scalar types. An input and output of scala type should always be value that GraphQL grammar supports like string, number, boolean, etc. Here is an example of `DateTime` (from joda-time) scalar type implementation:
  
```scala
case object DateCoercionViolation extends ValueCoercionViolation("Date value expected")

def parseDate(s: String) = Try(new DateTime(s, DateTimeZone.UTC)) match {
  case Success(date) ⇒ Right(date)
  case Failure(_) ⇒ Left(DateCoercionViolation)
}

val DateTimeType = ScalarType[DateTime]("DateTime",
  coerceOutput = date ⇒ ast.StringValue(ISODateTimeFormat.dateTime().print(date)),
  coerceUserInput = {
    case s: String ⇒ parseDate(s)
    case _ ⇒ Left(DateCoercionViolation)
  },
  coerceInput = {
    case ast.StringValue(s, _) ⇒ parseDate(s)
    case _ ⇒ Left(DateCoercionViolation)
  })
```

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
val errorHandler: Executor.ExceptionHandler = {
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

## Helpers

There are quite a few helpers available which you may find useful in different situations.

### Introspection Result Parsing

Sometimes you would like to work with the results of an introspection query. This can be necessary in some client-side tools, for instance. Instead of forking directly with JSON (or other raw representation), you can pars it in a set of case classes that allow you to easily work with the whole schema introspection. 

You can find a parser function in `sangria.introspection.IntrospectionParser`.
 
### Determine a Query Operation Type

Sometimes it can be very useful to know the type of query operation. For example you need it if you want to return different response for subscription queries. `ast.Document` exposes `operationType` and `operation` for this.
