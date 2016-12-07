---
layout: normal-page
animateHeader: false
title: Getting Started with Sangria
---

## Getting Started with Sangria

{% include caution.html %}

**Sangria** is a Scala [GraphQL]({{site.link.graphql}}) implementation.

Here is how you can add it to your SBT project:

```scala
libraryDependencies += "{{site.groupId}}" %% "sangria" % "{{site.version.sangria}}"
```

You can find an example application that uses akka-http with _sangria_ here (it is also available as an [Activator template]({{site.link.akka-http-example.activator}})):

[{{site.link.akka-http-example.github}}]({{site.link.akka-http-example.github}})

I would also recommend you to check out [{{site.link.try}}]({{site.link.try}}).
It is an example of a GraphQL server written with the Play framework and Sangria. It also serves as a playground,
where you can interactively execute GraphQL queries and play with some examples.

[Apollo Client](http://dev.apollodata.com/) is a full featured, simple to use GraphQL client with convenient integrations for popular view layers. Apollo Client is an easy way to get started with Sangria as they're 100% compatible.

If you want to use sangria with the react-relay framework, then you also need to include [sangria-relay]({{site.link.repo.sangria-relay}}):

```scala
libraryDependencies += "{{site.groupId}}" %% "sangria-relay" % "{{site.version.sangria-relay}}"
```

Sangria-relay Playground ([{{site.link.try-relay}}]({{site.link.try-relay}})) is a nice place to start if you would like to see it in action.

## Define GraphQL Schema

In order to execute queries, you first need to define a schema for your data. It contains description of objects, interfaces, fields, enums, etc.
Here is a small example of the schema for a blog application:

```scala
import sangria.schema._

val BlogImageType = ObjectType("Image", fields[Unit, Image](
  Field("url", OptionType(StringType), resolve = _.value.url),
  Field("width", OptionType(IntType), resolve = _.value.width),
  Field("height", OptionType(IntType), resolve = _.value.height)))

val BlogAuthorType = ObjectType("Author", () => fields[Unit, Author](
  Field("id", OptionType(StringType), resolve = _.value.id),
  Field("name", OptionType(StringType), resolve = _.value.name),
  Field("pic", OptionType(BlogImageType),
    arguments =
      Argument("width", OptionInputType(IntType)) ::
      Argument("height", OptionInputType(IntType)) ::
      Nil,
    resolve = ctx =>
      for {
        w <- ctx.argOpt[Int]("width")
        h <- ctx.argOpt[Int]("height")
        pic <- ctx.value.pic(w, h)
      } yield pic),
  Field("recentArticle", OptionType(BlogArticleType),
    resolve = ctx =>
      ctx.value.recentArticle
        .map(ra => DeferredValue(ArticleDeferred(ra)))
        .getOrElse(Value(None)))))

val BlogArticleType: ObjectType[Unit, Article] =
  ObjectType("Article", fields[Unit, Article](
    Field("id", StringType, resolve = _.value.id),
    Field("isPublished", OptionType(BooleanType), resolve = _.value.isPublished),
    Field("author", OptionType(BlogAuthorType), resolve = _.value.author),
    Field("title", OptionType(StringType), resolve = _.value.title),
    Field("body", OptionType(StringType), resolve = _.value.body),
    Field("keywords", OptionType(ListType(OptionType(StringType))),
      resolve = _.value.keywords)))

val BlogQueryType = ObjectType("Query", fields[Unit, Unit](
  Field("article", OptionType(BlogArticleType),
    arguments = Argument("id", OptionInputType(IDType)) :: Nil,
    resolve = ctx => ctx.argOpt[String]("id") flatMap (id => article(id.toInt))),
  Field("feed", OptionType(ListType(OptionType(BlogArticleType))),
    resolve = _ => (1 to 10).toList.map(article))))

val BlogSchema = Schema(BlogQueryType)
```

As you can see, every field defines not only meta-information, like name and description, but also a `resolve` function.
It is needed during the query execution in order to extract actual value from the contextual object.

After you have defined the schema, you are ready to parse and execute GraphQL queries.

## Parse GraphQL Query

Query parsing can be done like this:

```scala
import sangria.parser.QueryParser

val Success(queryAst: Document) = QueryParser.parse(query)
```

`parse` object gives back a `Try` object indicating that parsing can fail (you can customise this behaviour by importing different `DeliveryScheme`)

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

## Execution

Here is an example of how you can execute the example schema:

```scala
import sangria.execution.Executor
import scala.concurrent.ExecutionContext.Implicits.global

Executor.execute(BlogSchema, queryAst)
```

By default, the result of the execution is a JSON-like structure of Scala `Map` and `List` objects. It can be very helpful for testing or experimentation.
But as soon as you want to integrate it with some web framework, like Play or akka-http, you probably want to get some JSON AST as the result of execution.

Sangria allows you to do this by importing one of the following objects:

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
* `sangria.marshalling.ion._` - [Amazon Ion](http://amznlabs.github.io/ion-docs/index.html) serialization
  * `"{{site.groupId}}" %% "sangria-ion" % "{{site.version.sangria-ion}}"`  

This will provide an executor with different marshalling mechanism and produce a `Future` with a JSON AST of your choice.

## Next steps

This page highlights only a small subset of sangria capabilities and features. I would recommend you to play with [sangria-playground]({{site.link.try}}) mentioned above. You can also look
into a more [in-depth sangria documentation]({{"/learn/" | prepend: site.baseurl}}).