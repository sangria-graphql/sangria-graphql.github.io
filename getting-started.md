---
layout: normal-page
animateHeader: false
title: Getting Started with Sangria
---

## Getting Started with Sangria

{% include caution.html %}

**Sangria** is a Scala [GraphQL]({{site.link.graphql}}) implementation.

Here is how you can add it to your SBT project:

{% highlight scala %}
libraryDependencies += "{{site.groupId}}" %% "sangria" % "{{site.version.sangria}}"
{% endhighlight %}

You can find an example application that uses akka-http with _sangria_ here (it is also available as an [Activator template]({{site.link.akka-http-example.activator}})):

[{{site.link.akka-http-example.github}}]({{site.link.akka-http-example.github}})

I would also would recommend you to check out [{{site.link.try}}]({{site.link.try}}).
It is an example of a GraphQL server written with the Play framework and Sangria. It also serves as a playground,
where you can interactively execute GraphQL queries and play with some examples.

If you want to use sangria with the react-relay framework, then you also need to include [sangria-relay]({{site.link.repo.sangria-relay}}):

{% highlight scala %}
libraryDependencies += "{{site.groupId}}" %% "sangria-relay" % "{{site.version.sangria-relay}}"
{% endhighlight %}

## Define GraphQL Schema

In order to execute queries, you first need to define a schema for your data. It contains description of objects, interfaces, fields, enums, etc.
Here is a small example of the schema for a blog application:

{% highlight scala %}
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
{% endhighlight %}

As you can see, every field defines not only meta-information, like name and description, but also a `resolve` function.
It is needed during the query execution in order to extract actual value from the contextual object.

After you have defined the schema, you are ready to parse and execute GraphQL queries.

## Parse GraphQL Query

Query parsing can be done like this:

{% highlight scala %}
import sangria.parser.QueryParser

val Success(queryAst: Document) = QueryParser.parse(query)
{% endhighlight %}

`parse` object gives back a `Try` object indicating that parsing can fail (you can customise this behaviour by importing different `DeliveryScheme`)

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

## Execution

Here is an example of how you can execute the example schema:

{% highlight scala %}
import sangria.execution.Executor
import scala.concurrent.ExecutionContext.Implicits.global

Executor.execute(BlogSchema, queryAst)
{% endhighlight %}

By default, the result of the execution is a JSON-like structure of scala `Map` and `List` objects. It can be very helpful for testing or experimentation.
But as soon as you want to integrate it with some web framework, like Play or akka-http, you probably want to get some JSON AST as the result of execution.

Sangria allows you to do this by importing one of the following objects:

* `sangria.integration.json4s._` - json4s serialization/deserialization
* `sangria.integration.sprayJson._` - spray-json serialization/deserialization
* `sangria.integration.playJson._` - play-json serialization/deserialization
* `sangria.integration.circe._` - circe serialization/deserialization

This will provide an executor with different marshalling mechanism and produce a `Future` with a JSON AST of your choice.

## Next steps

I would recommend you to play with [the example project]({{site.link.akka-http-example.github}}) mentioned above. You can also look
into a more [in-depth sangria documentation]({{"/learn/" | prepend: site.baseurl}}).