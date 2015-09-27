---
layout: normal-page
animateHeader: false
title: Learn Sangria
---

## Overview

{% include caution.html %}

**Sangria** is a Scala [GraphQL]({{site.link.graphql}}) implementation.

Here is how you can add it to your SBT project:

{% highlight scala %}
libraryDependencies += "{{site.groupId}}" %% "sangria" % "{{site.version.sangria}}"
{% endhighlight %}

You can find an example application that uses akka-http with _sangria_ here:

[{{site.link.akka-http-example.github}}]({{site.link.akka-http-example.github}})

It is also available as an [Activator template]({{site.link.akka-http-example.activator}}).

I would also would recommend you to check out [{{site.link.try}}]({{site.link.try}}).
It is an example of GraphQL server written with Play framework and Sangria. It also serves as a playground,
where you can interactively execute GraphQL queries and play with some examples.

If you want to use sangria with react-relay framework, they you also need to include [sangria-relay]({{site.link.repo.sangria-relay}}):

{% highlight scala %}
libraryDependencies += "{{site.groupId}}" %% "sangria-relay" % "{{site.version.sangria-relay}}"
{% endhighlight %}

## Query Parser and Renderer

Example usage:

{% highlight scala %}
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
{% endhighlight %}

Alternatively you can use `graphql` macro, which will ensure that you query is syntactically correct at compile time:

{% highlight scala %}
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
{% endhighlight %}

## Schema Definition

Here is an example of GraphQL schema DSL:

{% highlight scala %}
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
      resolve = Projection("_id", _.value.id)),
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
      resolve = Projector((ctx, f)=> ctx.ctx.getDroid(ctx arg ID).get))
  ))

val StarWarsSchema = Schema(Query)
{% endhighlight %}

### Deferred Values and Resolver

In the example schema, you probably noticed, that some of the resolve functions return `DeferFriends`. It is defined like this:

{% highlight scala %}
case class DeferFriends(friends: List[String]) extends Deferred[List[Character]]
{% endhighlight %}

Defer mechanism allows you to postpone the execution of particular fields and then batch them together in order to optimise object retrieval.
This can be very useful when you are trying N+1. In this example all of the characters have list of friends, but they only have IDs of them.
You need to fetch from somewhere in order to progress query execution.
Retrieving evey friend one-by-one would be inefficient, since you potentially need to access an external database
in order to do so. Defer mechanism allows you to batch all these friend list retrieval requests in one efficient request to the DB. In order to do it,
you need to implement a `DeferredResolver`, that will get a list of deferred values:

{% highlight scala %}
class FriendsResolver extends DeferredResolver[Any] {
  def resolve(deferred: List[Deferred[Any]], ctx: Any): List[Future[Any]] =
    // your bulk friends retrieving logic
}
{% endhighlight %}

### Projections

Sangria also introduces the concept of projections. If you are fetching your data from the database (like let's say MongoDB), then it can be
very helpful to know which fields are needed for the query ahead-of-time in order to make efficient projection in the DB query.

`Projector` and `Projection` allow you to do this. They both can wrap a `resolve` function. `Projector` enhances wrapped `resolve` function
with the list of projected fields (limited by depth), and `Projection` allows you to customise projected
field name (this is helpful, if your DB field names are different from the GraphQL field names).
`NoProjection` on the other hand allows you to exclude a field from the list of projected field names.

### Input and Context Objects

Many schema elements, like `ObjectType`, `Field` or `Schema` itself, take two type parameters: `Ctx` and `Val`:

* `Val` - represent values that are returned by `resolve` function and given to resolve function as a part of the `Context`. In the schema example,
  `Val` can be a `Human`, `Droid`, `String`, etc.
* `Ctx` - represents some contextual object that flows across the whole execution (and doesn't change in most of the cases). It can be provided to execution by the user
  in order to help fulfill the GraphQL query. A typical example of such context object is as service or repository object that is able to access
  a Database. In example schema some of the fields, like `droid` or `human` make use of it in order to access the character repository.

## Query Execution

Here is an example of how you can execute example schema:

{% highlight scala %}
import sangria.execution.Executor

Executor(TestSchema.StarWarsSchema, userContext = new CharacterRepo, deferredResolver = new FriendsResolver)
  .execute(queryAst, variables = vars)
{% endhighlight %}

The result of the execution is a `Future` of marshaled GraphQL result (see next section)

### Limiting Query Depth

If you are using recursive GraphQL types, it can be dangerous to expose them since query can be infinitely nested and potentially can be
abused. In order to prevent this, `Executor` allows you to restrict max query depth via `maxQueryDepth` argument:

{% highlight scala %}
val executor = Executor(
  schema = SchemaDefinition.StarWarsSchema,
  userContext = new CharacterRepo,
  deferredResolver = new FriendsResolver,
  maxQueryDepth = Some(7))
{% endhighlight %}

## Result Marshalling and Input Unmarshalling

GraphQL query execution needs to know how to serialize the result of execution and how to deserialize arguments/variables.
Specification itself does not define the data format, instead it uses abstract concepts like map and list.
Sangria does not hard-code the serialisation mechanism. Instead it provides two traits for this:

* `ResultMarshaller` - knows how to serialize results of execution
* `InputUnmarshaller[Node]` - knows how to deserialize the arguments/variables

At the moment Sangria provides implementations fro these libraries:

* `sangria.integration.json4s._` - json4s serialization/deserialization
* `sangria.integration.sprayJson._` - spray-json serialization/deserialization
* `sangria.integration.playJson._` - play-json serialization/deserialization
* `sangria.integration.circe._` - circe serialization/deserialization
* The default one, which serializes/deserializes to scala `Map`/`List`

In order to use one of these, just import it and the result of execution will be of the correct type:

{% highlight scala %}
{
  import sangria.integration.json4s._
  import org.json4s.native.JsonMethods._

  println("Json4s marshalling:\n")

  println(pretty(render(Await.result(
    Executor(TestSchema.StarWarsSchema, userContext = new CharacterRepo, deferredResolver = new FriendsResolver)
        .execute(ast, variables = vars), Duration.Inf))))
}

{
  import sangria.integration.sprayJson._

  println("\nSprayJson marshalling:\n")

  println(Await.result(
    Executor(TestSchema.StarWarsSchema, userContext = new CharacterRepo, deferredResolver = new FriendsResolver)
        .execute(ast, variables = vars), Duration.Inf).prettyPrint)
}

{
  import sangria.integration.playJson._
  import play.api.libs.json._

  println("\nPlayJson marshalling:\n")

  println(Json.prettyPrint(Await.result(
    Executor(TestSchema.StarWarsSchema, userContext = new CharacterRepo, deferredResolver = new FriendsResolver)
        .execute(ast, variables = vars), Duration.Inf)))
}
{% endhighlight %}

## Built-in Scalars

Sangria support all standard GraphQL scalars like `String`, `Int`, `ID`, etc. In addition, sangria introduces following built-in scalar types:

* `Long` - a 64 bit integer value which is represented as a `Long` in scala code
* `BigInt` - similar to `Int` scalar value, but allows you to transfer big integer values and represents them in code as scala's `BigInt` class
* `BigDecimal` - similar to `Float` scalar value, but allows you to transfer big decimal values and represents them in code as scala's `BigDecimal` class

## Deprecation Tracking

GraphQL schema allows you to declare fields and enum values as deprecated. When you execute a query, you can provide your custom implementation of
`DeprecationTracker` trait to the `Executor` in order to track deprecated fields and enum values (you can, for instance, log all usages or send metrics to graphite):

{% highlight scala %}
trait DeprecationTracker {
  def deprecatedFieldUsed[Ctx](ctx: Context[Ctx, _]): Unit
  def deprecatedEnumValueUsed[T, Ctx](enum: EnumType[T], value: T, userContext: Ctx): Unit
}
{% endhighlight %}