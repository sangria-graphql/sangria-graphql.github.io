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

I would also recommend that you check out [{{site.link.try}}]({{site.link.try}}).
It is an example of a GraphQL server written with Play framework and Sangria. It also serves as a playground,
where you can interactively execute GraphQL queries and play with some examples.

[Apollo Client](http://dev.apollodata.com/) is a full featured, simple to use GraphQL client with convenient integrations for popular view layers. Apollo Client is an easy way to get started with Sangria as they're 100% compatible.

If you want to use sangria with the react-relay framework, then you also need to include [sangria-relay]({{site.link.repo.sangria-relay}}):

```scala
libraryDependencies += "{{site.groupId}}" %% "sangria-relay" % "{{site.version.sangria-relay}}"
```

Sangria-relay Playground ([{{site.link.try-relay}}]({{site.link.try-relay}})) is a nice place to start if you would like to see it in action.

I would also recommend that you check out ["Videos" section of the community page]({{"/community/#videos" | prepend: site.baseurl}}).
It has a lot of nice introduction videos.

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

// Parse GraphQL query
QueryParser.parse(query) match {
  case Success(document) =>
    // Pretty rendering of the GraphQL query as a `String`
    println(document.renderPretty)

  case Failure(error) =>
    println(s"Syntax error: ${error.getMessage}")
}
```

Alternatively you can use `graphql` macro, which will ensure that your query is syntactically correct at compile time:

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

You can also parse and render the GraphQL input values independently from a query document:

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

println(parsed.renderPretty)
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
        resolve = ctx => DeferFriends(ctx.value.friends)),
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
      resolve = ctx => ctx.ctx.getHero(ctx.argOpt(EpisodeArg))),
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

The `resolve` argument of a `Field` expects a function of type `Context[Ctx, Val] => Action[Ctx, Res]`.
As you can see, the result of the `resolve` is an `Action` type which can take different shapes.
Here is the list of supported actions:

- `Value` - a simple value result. If you want to indicate an error, you need to throw an exception
- `TryValue` - a `scala.util.Try` result
- `FutureValue` - a `Future` result
- `PartialValue` - a partially successful result with a list of errors
- `PartialFutureValue` - a `Future` of partially successful result
- `DeferredValue` - used to return a `Deferred` result (see the [Deferred Values and Resolver](#deferred-value-resolution) section for more details)
- `DeferredFutureValue` - the same as `DeferredValue` but allows you to return `Deferred` inside of a `Future`
- `UpdateCtx` - allows you to transform a `Ctx` object. The transformed context object would be available for nested sub-objects and subsequent sibling fields in case of mutation (since execution of mutation queries is strictly sequential). You can find an example of its usage in the [Authentication and Authorisation](#authentication-and-authorisation) section.

Normally the library is able to automatically infer the `Action` type, so that you don't need to specify it explicitly.

### Projections

Sangria also introduces the concept of projections. If you are fetching your data from the database (like let's say MongoDB), then it can be
very helpful to know which fields are needed for the query ahead-of-time in order to make an efficient projection in the DB query.

`Projector` allows you to do precisely this. It wraps a `resolve` function and enhances it
with the list of projected fields (limited by depth). The `ProjectionName` field tag allows you to customize projected
field names (this is helpful if your DB field names are different from the GraphQL field names).
The `ProjectionExclude` field tag, on the other hand, allows you to exclude a field from the list of projected field names.

### Input and Context Objects

Many schema elements, like `ObjectType`, `Field` or `Schema` itself, take two type parameters: `Ctx` and `Val`:

- `Val` - represent values that are returned by the `resolve` function and given to the `resolve` function as a part of the `Context`. In the schema example,
  `Val` can be a `Human`, `Droid`, `String`, etc.
- `Ctx` - represents some contextual object that flows across the whole execution (and doesn't change in most of the cases). It can be provided to execution by the user
  in order to help fulfill the GraphQL query. A typical example of such a context object is a service or repository object that is able to access
  a database. In the example schema, some of the fields (like `droid` or `human`) make use of it in order to access the character repository.

### Providing Additional Types

After a schema is defined, the library tries to discover all of the supported GraphQL types by traversing the schema. Sometimes you have a situation where not all
GraphQL types are explicitly reachable from the root of the schema. For instance, if the example schema had only the `hero` field in the `Query` type, then
it would not be possible to automatically discover the `Human` and the `Droid` type, since only the `Character` interface type is referenced inside of the schema.

If you have a similar situation, then you need to provide additional types like this:

```scala
val HeroOnlyQuery = ObjectType[CharacterRepo, Unit](
  "HeroOnlyQuery", fields[CharacterRepo, Unit](
    Field("hero", TestSchema.Character,
      arguments = TestSchema.EpisodeArg :: Nil,
      resolve = ctx => ctx.ctx.getHero(ctx.argOpt(TestSchema.EpisodeArg)))
  ))

val heroOnlySchema = Schema(HeroOnlyQuery,
  additionalTypes = TestSchema.Human :: TestSchema.Droid :: Nil)
```

Alternatively you can use `manualPossibleTypes` on the `Field` and `InterfaceType` to achieve the same effect.

### Circular References and Recursive Types

In some cases you need to define a GraphQL schema that contains recursive types or has circular references in the object graph. Sangria supports such schemas
by allowing you to provide a no-arg function that creates `ObjectType` fields instead of an eager list of fields. Here is an example of interdependent types:

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

You can render a schema or an introspection result in human-readable form (SDL syntax) with `SchemaRenderer`. Here is an example:

```scala
SchemaRenderer.renderSchema(SchemaDefinition.StarWarsSchema)
```

For a StarWars schema it will produce the following results:

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

## Macro-Based GraphQL Type Derivation

Defining schema with `ObjectType`, `InputObjectType` and `EnumType` can become quite verbose. They provide maximum flexibility, but sometimes you just have a simple case class which you would like to expose via GraphQL API.

For this, sangria provides a set of macros that are able to derive GraphQL types from normal Scala classes, case classes and enums:

- `deriveObjectType[Ctx, Val]` - constructs an `ObjectType[Ctx, Val]` with fields found in `Val` class (case class accessors and members annotated with `@GraphQLField`)
- `deriveContextObjectType[Ctx, Target, Val]` - constructs an `ObjectType[Ctx, Val]` with fields found in `Target` class (case class accessors and members annotated with `@GraphQLField`). You also need to provide it a function `Ctx => Target` which the macro will use to get an instance of `Target` type from a user context.
- `deriveInputObjectType[T]` - constructs an `InputObjectType[T]` with fields found in `T` case class (only supports case class accessors)
- `deriveEnumType[T]` - constructs an `EnumType[T]` with values found in `T` enumeration. It supports Scala `Enumeration` as well as sealed hierarchies of case objects.

You need the following import to use them:

```scala
import sangria.macros.derive._
```

The use of these macros is completely optional, they just provide a bit of convenience when you need it. [Schema Definition DSL](#schema-definition) is the primary way to define a schema.

You can also influence the derivation by either providing a list of settings to the macro or using `@GraphQL*` annotations (these are `StaticAnnotation`s and only used to customize a macro code generation - they are erased at the runtime). This provides a very flexible way to derive GraphQL types based on your domain model - you can customize almost any aspect of the resulting GraphQL type (change names, add descriptions, add fields, deprecate fields, etc.).

In order to discover other GraphQL types, the macros use implicits. So if you derive interdependent types, make sure to make them implicitly available in the scope.

### ObjectType Derivation

`deriveObjectType` and `deriveContextObjectType` support arbitrary case classes as well as normal classes/traits.

Here is an example:

```scala
case class User(id: String, permissions: List[String], password: String)

val UserType = deriveObjectType[MyCtx, User](
  ObjectTypeName("AuthUser"),
  ObjectTypeDescription("A user of the system."),
  RenameField("id", "identifier"),
  DocumentField("permissions", "User permissions",
    deprecationReason = Some("Will not be exposed in future")),
  ExcludeFields("password"),
  AddFields(
    Field("reverse_name", BooleanType, resolve = _ => _.value.name.reverse)
  ))
```

It will generate an `ObjectType` which is equivalent to this one:

```scala
ObjectType("AuthUser", "A user of the system.", fields[MyCtx, User](
  Field("identifier", StringType, resolve = _.value.id),
  Field("permissions", ListType(StringType),
    description = Some("User permissions"),
    deprecationReason = Some("Will not be exposed in future"),
    resolve = _.value.permissions),
  Field("reverse_name", BooleanType, resolve = _ => _.value.name.reverse)))
```

#### Deriving Methods with Arguments

You can also use class methods as GraphQL fields. This will also correctly generate appropriate `Argument`s.

Let's look at the example:

```scala
case class User(firstName: String, lastName: Option[String])

trait Mutation {
  @GraphQLField
  def addUser(firstName: String, lastName: Option[String]) = {
    val user = User(firstName, lastName)

    add(user)
    user
  }

  // ...
}

case class MyCtx(mutation: Mutation)

implicit val UserType = deriveObjectType[MyCtx, User]()
val MutationType = deriveContextObjectType[MyCtx, Mutation, Unit](_.mutation)
```

Resulting mutation type would be equivalent to this one:

```scala
val FirstNameArg = Argument("firstName", StringType)
val LastNameArg = Argument("lastName", OptionInputType(StringType))

val MutationType = ObjectType("Mutation", fields[MyCtx, Unit](
  Field("addUser", UserType,
    arguments = FirstNameArg :: LastNameArg :: Nil,
    resolve = c => c.ctx.mutation.addUser(
      c.arg(FirstNameArg), c.arg(LastNameArg)))))
```

You can also define a method argument of type `Context[Ctx, Val]` - it will not be treated as an argument, but instead a field execution context would be provided to a method in this argument.

Default values of method arguments would be ignored. If you would like to provide a default value to an `Argument`, please use `@GraphQLDefault` instead.

Instead of using the `@GraphQLField` annotation, you can also provide the `IncludeMethods` setting as an argument to the macro.

### InputObjectType Derivation

`deriveInputObjectType` supports only case classes. Here is an example:

```scala
case class User(id: String, permissions: List[String], password: String)

val UserType = deriveInputObjectType[User](
  InputObjectTypeName("AuthUser"),
  InputObjectTypeDescription("A user of the system."),
  DocumentInputField("permissions", "User permissions"),
  RenameInputField("id", "identifier"),
  ExcludeInputFields("password"))
```

It will generate an `InputObjectType` which is equivalent to this one:

```scala
InputObjectType[User]("AuthUser", "A user of the system.", List(
  InputField("identifier", StringType),
  InputField("permissions", ListInputType(StringType),
    description = "User permissions")))
```

You can use `@GraphQLDefault` as well as normal Scala default values to provide a default value for an `InputField`.
The `@GraphQLDefault` annotation will be used as a default of both are defined.

### EnumType Derivation

`deriveEnumType` supports Scala `Enumeration` as well as sealed hierarchies of case objects.

First let's look at `Enumeration` example:

```scala
object Color extends Enumeration {
  val Red, LightGreen, DarkBlue = Value
}

val ColorType = deriveEnumType[Color.Value](
  IncludeValues("Red", "DarkBlue"))
```

It will generate an `EnumType` which is equivalent to this one:

```scala
EnumType("Color", values = List(
  EnumValue("Red", value = Color.Red),
  EnumValue("DarkBlue", value = Color.DarkBlue)))
```

And here is an example of sealed hierarchy of case objects:

```scala
sealed trait Fruit

case object RedApple extends Fruit
case object SuperBanana extends Fruit
case object MegaOrange extends Fruit

sealed abstract class ExoticFruit(val score: Int) extends Fruit

case object Guave extends ExoticFruit(123)

val FruitType = deriveEnumType[Fruit](
  EnumTypeName("Foo"),
  EnumTypeDescription("It's foo"))
```

It will generate an `EnumType` which is equivalent to this one:

```scala
EnumType("Foo", Some("It's foo"), List(
  EnumValue("RedApple", value = RedApple),
  EnumValue("SuperBanana", value = SuperBanana),
  EnumValue("MegaOrange", value = MegaOrange),
  EnumValue("Guave", value = Guave)))
```

{% include ext.html type="info" title="Co-locate deriveEnumType with actual sealed trait" %}
It is important to use `deriveEnumType` in the **same source file** where you have defined your sealed trait **after** all trait children are defined!
Otherwise macro will not be able to find all of the enum values.  
{% include cend.html %}

### Dealing With Recursive Types

Sometimes you need to model recursive and interdependent types. The macro needs a little bit of help: you must replace fields that use recursive types and define them manually.

Here is an example of an `ObjectType`:

```scala
case class A(id: Int, b: B)
case class B(name: String, a: A, b: B)

implicit lazy val AType = deriveObjectType[Unit, A](
  ReplaceField("b", Field("b", BType, resolve = _.value.b)))

implicit lazy val BType: ObjectType[Unit, B] = deriveObjectType(
  ReplaceField("a", Field("a", AType, resolve = _.value.a)),
  ReplaceField("b", Field("b", BType, resolve = _.value.b)))
```

An example of `InputObjectType`:

```scala
case class A(id: Int, b: Option[B])
case class B(name: String, a: A, b: Option[B])

implicit lazy val AType: InputObjectType[A] = deriveInputObjectType[A](
  ReplaceInputField("b", InputField("b", OptionInputType(BType))))

implicit lazy val BType: InputObjectType[B] = deriveInputObjectType[B](
  ReplaceInputField("a", InputField("a", AType)),
  ReplaceInputField("b", InputField("b", OptionInputType(BType))))
```

### Customizing Types With Annotations

You can use the following annotations to change different aspects of the resulting GraphQL types:

- `@GraphQLName` - use a different name for a type, field, enum value or an argument
- `@GraphQLDescription` - provide a description for a type, field, enum value or an argument
- `@GraphQLDeprecated` - deprecate an `ObjectType` field or an enum value
- `@GraphQLFieldTags` - provide field tags or an `ObjectType` field
- `@GraphQLExclude` - exclude a field, enum value or an argument
- `@GraphQLField` - include a member of a class (`val` or `def`) in the resulting `ObjectType`. This will also create the appropriate `Argument` list if the method takes some arguments
- `@GraphQLDefault` - provide a default value for an `InputField` or an `Argument`

Here is an example:

```scala
@GraphQLName("AuthUser")
@GraphQLDescription("A user of the system.")
case class User(
  @GraphQLDescription("User ID.")
  id: String,

  @GraphQLName("userPermissions")
  @GraphQLDeprecated("Will not be exposed in future")
  permissions: List[String],

  @GraphQLExclude
  password: String)

val UserType = deriveObjectType[MyCtx, User]()
val UserInputType = deriveInputObjectType[User](
  InputObjectTypeName("UserInput"))
```

As you can see, `InputObjectTypeName` is also used in this case. Macro settings always take precedence over the annotations.

## Schema Materialization

If you have an introspection result (coming from remote server, for instance) or an SDL-based schema definition, then you can create an executable in-memory schema representation out of it.

### Based on introspection

If you already got a full introspection result from a server, you can recreate an in-memory representation of the schema with `IntrospectionSchemaMaterializer`. This feature has a lot of potential for client-side tools: testing, mocking, creating proxy/facade GraphQL servers, etc.

Here is a simple example of how you can use this feature (using circe in this particular example):

```scala
import io.circe._
import sangria.marshalling.circe._

val introspectionResults: Json = ??? // coming from other server or file
val clientSchema: Schema[Any, Any] =
  Schema.buildFromIntrospection(introspectionResults)
```

It takes the result of a full introspection query (loaded from the server, file, etc.) and recreates the schema definition with stubs for
resolve methods. You can customize a lot of aspects of the materialization by providing a custom `IntrospectionSchemaBuilder`
implementation (you can also extend `DefaultIntrospectionSchemaBuilder` class). This means that you can, for instance, plug in some
generic field resolution logic or provide generic logic for custom scalars. Without these customizations, the materialized schema would
only be able to execute introspection queries.

### Based on SDL definitions

In addition to normal query syntax, GraphQL allows you to define the schema itself. This is how the syntax look like:

```js
interface Character {
  id: Int!
  name: String!
}

"""
The human character
"""
type Human implements Character {
  id: Int!
  name: String!
  height: Float
}

"""
The root query type
"""
type Query {
  "The main hero or the saga"
  hero: Character
}

schema {
  query: Query
}
```

You can recreate an in-memory representation of the schema with `AstSchemaMaterializer` (just like with the introspection-based one).
This feature has a lot of potential for client-side tools: testing, mocking, creating proxy/facade GraphQL servers, etc.

Here is a simple example of how you can use this feature:

```scala
val ast =
  graphql"""
    schema {
      query: Hello
    }

    type Hello {
      bar: Bar
    }

    type Bar {
      isColor: Boolean
    }
  """

val clientSchema: Schema[Any, Any] =
  Schema.buildFromAst(ast)
```

It takes a schema AST (in this example the `graphql` macro is used, but you can also use `QueryParser.parse` to parse the schema dynamically)
and recreates the schema definition with stubs for resolve methods. You can customize a lot of aspects of the materialization by providing a
custom `AstSchemaBuilder` implementation (you can also extend `DefaultAstSchemaBuilder` class). This means that you can, for instance,
plug in some generic field resolution logic or provide generic logic for custom scalars. Without these customizations, the materialized
schema would only be able to execute introspection queries.

### High-level SDL-based Schema Builder

`AstSchemaBuilder` and `DefaultAstSchemaBuilder` provide a lot of flexibility in how you build the schema based on the SDL AST, but the are
also quite low-level API and hard to work with directly. Sangria provides more higher-level API that is based on `resolve` functions that are
defined in the scope of the whole schema based on the directives and other SDL elements. `ResolverBasedAstSchemaBuilder` or `AstSchemaBuilder.resolverBased`
allow you to do this. They take a list of `AstSchemaResolver`s as an argument. Each resolver might contribute specific logic in the generated schema.

Let's look a the simple example that primarily uses JSON as a data type (quite typical for GraphQL API that aggregates other JSON API).
The schema definition looks like this:

```scala
val schemaAst =
  gql"""
    enum Color {
      Red, Green, Blue
    }

    interface Fruit {
      id: ID!
    }

    type Apple implements Fruit {
      id: ID!
      color: Color
    }

    type Banana implements Fruit {
      id: ID!
      length: Int
    }

    type Query @addSpecial {
      fruit: Fruit
      bananas: [Fruit] @generateBananas(count: 3)
    }
  """
```

It contains several interesting elements which we need to implement in the schema builder:

1. `Fruit` is an interface type, so we need to properly define an instance check in order to select appropriate `ObjectType`
   based on the `type` JSON field (in this example)
2. `@generateBananas` directive defines the resolution logic for `bananas` field. We need to define a resolver for it and generate
   a simple list with size `count`.
3. `@addSpecial` directive needs to add new field in the `Query` type.
4. For all other fields in the schema we need to define default behavior that just transforms context JSON value in appropriate
   GraphQL representation.

Given all these requirements, we can defined a schema builder like this:

```scala
val CountArg = Argument("count", IntType)

val GenerateBananasDir = Directive("generateBananas",
  arguments = CountArg :: Nil,
  locations = Set(DL.FieldDefinition))

val AddSpecialDir = Directive("addSpecial",
  locations = Set(DL.Object))

val builder = AstSchemaBuilder.resolverBased[Unit](
  // Requirement #1 - provides appropriate instance check based on the `type` JSON field
  InstanceCheck.field[Unit, JsValue],

  // Requirement #2 - defined a resolution logic based on the `@generateBananas` directive
  DirectiveResolver(GenerateBananasDir, c =>
    (1 to c.arg(CountArg)) map (id => JsObject(
      "type" -> JsString("Banana"),
      "id" -> JsString(id.toString),
      "length" -> JsNumber(id * 10)))),

  // Requirement #3 - add extra field based on the `@addSpecial` directive
  DirectiveFieldProvider(AddSpecialDir, c =>
    MaterializedField(StandaloneOrigin,
      Field("specialFruit", c.objectType("Banana"), resolve =
        ResolverBasedAstSchemaBuilder.extractFieldValue[Unit, JsValue])) :: Nil),

  // Requirement #4 - provides default behaviour for all other fields
  FieldResolver.defaultInput[Unit, JsValue])
```

Now that we have the schema builder, we can define the schema itself:

```scala
val schema = Schema.buildFromAst(schemaAst,
  builder.validateSchemaWithException(schemaAst))
```

Here we are also using `builder.validateSchemaWithException` to validate the AST and ensure that all directives are known and correct (
`builder.validateSchema` will just return a list of violations).

Now we are ready to execute the schema against a query and provide it with initial root JSON value:

```scala
val query =
  gql"""
    {
      fruit {
        id

        ... on Apple {color}
        ... on Banana {length}
      }

      bananas {
        ... on Banana {length}
      }

      specialFruit {id}
    }
  """

val initialData =
  """
    {
      "fruit": {
        "type": "Apple",
        "id": "1",
        "color": "Red"
      },
      "specialFruit": {
        "type": "Apple",
        "id": "42",
        "color": "Blue"
      }
    }
  """.parseJson

Executor.execute(schema, query, root = initialData)
```

The result of an execution would be JSON like this one:

```json
{
  "data": {
    "fruit": { "id": "1", "color": "Red" },
    "bananas": [{ "length": 10 }, { "length": 20 }, { "length": 30 }],
    "specialFruit": { "id": "42" }
  }
}
```

`ResolverBasedAstSchemaBuilder` provides a lot of features. All supported resolvers are subtypes of `AstSchemaResolver`, so you can check
these if you would like to learn about other features, like providing additional types with `AdditionalTypes`, handling scalar values with
`ScalarResolver`, etc.

Sometimes it might be very useful to analyze the schema AST document in order to collect information about some of the used directives in advance (before building the schema).
This can be achieved with `ResolverBasedAstSchemaBuilder.resolveDirectives`. Here is a small example:

```scala
val ValueArg = Argument("value", IntType)
val NumDir = Directive("num",
  arguments = ValueArg :: Nil,
  locations = Set(DirectiveLocation.Schema, DirectiveLocation.Object))

val collectedValue = schemaAst.analyzer.resolveDirectives(
  GenericDirectiveResolver(NumDir, resolve = c => Some(c arg ValueArg))).sum
```

In this example, the resulting `collectedValue` will contain the sum of all numbers collected via `@num` directive.

For another example of SDL-based schema materialization, please see the next section. I would also recommend to look at
[Materializer class](https://github.com/OlegIlyenko/graphql-toolbox/blob/master/app/controllers/Materializer.scala) in
[graphql-toolbox project](https://github.com/OlegIlyenko/graphql-toolbox). It contains much bigger and more comprehensive example.

If you have previously worked with [apollo-tools](https://github.com/apollographql/graphql-tools) and would like to know how SDL-based schema definition translates to sangria, then
`ResolverBasedAstSchemaBuilder` is a good place to start. Some apollo-tools examples use exact type/field name matches in order to define the
resolve functions. You can achieve the same in sangria by using `FieldResolver`:

```scala
val builder = resolverBased[Any](
  FieldResolver.map(
    "Query" -> Map(
      "posts" -> (context => ...)),
    "Mutation" -> Map(
      "upvotePost" -> (context => ...)),
    "Post" -> Map(
      "author" -> (context => ...),
      "comments" -> (context => ...))),
  AnyFieldResolver.defaultInput[Any, JsValue])
```

Though general recommendation is to use `DirectiveResolver` instead of explicit `FieldResolver` if possible, since it provides more robust
mechanism to define the resolution logic.

### Schema Materialization Example

Schema materialization can be overwhelming at first, so let's go though a small example that combines static schema defined with scala code and
dynamic SDL-based schema extensions.

First we need to define some model classes and repository that we will use in this example:

```scala
case class Article(id: String, title: String, text: String, author: Option[String])

class Repo {
  def loadArticle(id: String): Option[Article] =
    Some(Article(id, s"Test Article #$id", "blah blah blah...", Some("Bob")))

  def loadComments: List[JsValue] =
    List(JsObject(
      "text" -> JsString("First!"),
      "author" -> JsObject(
        "name" -> JsString("Jane"),
        "lastComment" -> JsObject(
          "text" -> JsString("Boring...")))))
}
```

In order to demonstrate different approaches, we represent `Article` as a case class and `comments` as a JSON
value (using spray-json in this example).

Now let's define static part of the schema:

```scala
val ArticleType = deriveObjectType[Repo, Article]()

val IdArg = Argument("id", StringType)

val QueryType = ObjectType("Query", fields[Repo, Unit](
  Field("article", OptionType(ArticleType),
    arguments = IdArg :: Nil,
    resolve = c => c.ctx.loadArticle(c arg IdArg))))

val staticSchema = Schema(QueryType)
```

Nothing special going on here - just a standard schema definition. It becomes more interesting when we add schema extentions into the mix:

```scala
val extensions =
  gql"""
    extend type Article {
      comments: [Comment]! @loadComments
    }

    type Comment {
      text: String!
      author: CommentAuthor!
    }

    type CommentAuthor {
      name: String!
      lastComment: Comment
    }
  """

val schema = staticSchema.extend(extensions, builder)
```

This code will extend an `Article` GraphQL type and add `comments` field. Also notice that `Comment` and `CommentAuthor` types
are mutually recursive. In order simplify the builder logic, we also use `@loadComments` directive. The only missing piece
of the puzzle is the `builder` itself:

```scala
val LoadCommentsDir = Directive("loadComments",
  locations = Set(DirectiveLocation.FieldDefinition))

val builder = AstSchemaBuilder.resolverBased[Repo](
  DirectiveResolver(LoadCommentsDir, _.ctx.ctx.loadComments),
  FieldResolver.defaultInput[Repo, JsValue])
```

As you can see, we are using `@loadComments` directive to define a special `resolve` function logic that loads all of the comments.
In general it is recommended approach to handle field logic in the builder
(an alternative would be to rely of the field/type names with `FieldResolver {case (TypeName("Article"), FieldName("comments")) => ...}` which is quite fragile).

All other fields are defined in terms of `resolveJson` function. It just adopts contextual value (which is JSON in our example)
to the field's return type. This implementation is by no means complete - it just shows a short example.
For production application you would need to improve this logic according to the needs of the application.

Now we are ready to execute query against out new shiny schema:

```scala
val query =
  gql"""
    {
      article(id: "42") {
        title
        text
        comments {
          text
          author {
            name
            lastComment {
              text
            }
          }
        }
      }
    }
  """

Executor.execute(schema, query, new Repo)
```

Result of the execution would look like this:

```json
{
  "data": {
    "article": {
      "title": "Test Article #42",
      "text": "blah blah blah...",
      "comments": [
        {
          "text": "First!",
          "author": {
            "name": "Jane",
            "lastComment": {
              "text": "Boring..."
            }
          }
        }
      ]
    }
  }
}
```

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

In some situations, you may need to make a static query analysis and postpone the actual execution of the query. Later on, you may need to execute this query several times. A typical example is subscription queries: you first validate and prepare a query, and then you execute it several times for every event. This is precisely what `PreparedQuery` allows you to do.

Let's look at the example:

```scala
val preparedQueryFuture = Executor.prepare(StarWarsSchema, query,
  new CharacterRepo,
  deferredResolver = new FriendsResolver)

preparedQueryFuture.map(preparedQuery =>
  preparedQuery.execute(userContext = someCustomCtx, root = event))
```

`Executor.prepare` will return you a `Future` with a prepared query which you can execute several times later, possibly providing different `userContext` or `root` values. In addition to `execute`, `PreparedQuery` also gives you a lot of information about the query itself: operation, root `QueryType`, top-level fields with arguments, etc.

### Alternative Execution Scheme

The `Future` of marshaled result is not the only possible result of a query execution. By importing different implementation of `ExecutionScheme` you can
change the result type of an execution. Here is an example:

```scala
import sangria.execution.ExecutionScheme.Extended

val result: Future[ExecutionResult[Ctx, JsValue]] =
  val Executor.execute(schema, query)
```

`Extended` execution scheme gives you the result of the execution together with additional information about the execution itself (like, for instance, the list of exceptions that happened during the execution).

Following execution schemes are available:

- `Default` - The default one. Returns a `Future` of marshaled result
- `Extended` - Returns a `Future` containing `ExecutionResult`.
- `Stream` - Returns a stream of results. Very useful for subscription and batch queries, where the result is an `Observable` or a `Source`
- `StreamExtended` - Returns a stream of `ExecutionResult`s

### Batch Executor

{% include ext.html type="info" title="Experimental" %}
Please use this feature with caution! It might be removed in future releases or have big semantic changes. In particular in the way how variables are inferred and merged.
{% include cend.html %}

Batch executor allow you to execute several inter-dependent queries and get an execution result as a stream.
Dependencies are expressed via variables and `@export` directive. It provides following features:

- Allows specifying multiple `operationNames` when executing a GraphQL query document.
  All operations would be executed in order inferred from the dependencies between queries.
- Support for `@export(as: "foo")` directive. This directive allows you to save the results of
  the query execution and then use it as a variable in a different query within the same document.
  This provides a way to define data dependencies between queries.
- When used with `@export` directive, the variables would be automatically inferred by the execution
  engine, so you don't need to declare them explicitly
- You still can declare variables explicitly and completely disable variable inference with `inferVariableDefinitions` flag

Batch executor implementation is inspired by this talk:

{% include video.html id="ViXL0YQnioU?start=626&end=769" title="GraphQL Future at react-europe 2016" name="Laney Kuenzel & Lee Byron " %}

You can use any [execution scheme](#alternative-execution-scheme) with batch executor, but `Stream` and `StreamExtended` are recommended
since they will return execution results for all of the queries as a stream.

In the example below we are using monix for streaming and spray-json for data serialization. Also notice that we need to explicitly
add `BatchExecutor.ExportDirective` directive and use `BatchExecutor.executeBatch` instead of standard executor:

```scala
import monix.execution.Scheduler.Implicits.global

import sangria.execution.ExecutionScheme.Stream
import sangria.marshalling.sprayJson._
import sangria.streaming.monix._

val schema = Schema(..., directives = BuiltinDirectives :+ BatchExecutor.ExportDirective)

val result: Observable[JsValue] =
  BatchExecutor.executeBatch(schema, query,
    operationNames = List("StoryComments", "NewsFeed"))
```

You can also use `BatchExecutor.OperationNameExtension` middleware to include an operation name in the execution results (as an extension).
This will make it easier for a client to distinguish between different execution results coming from the same response stream.

Here is an example of request that will execute 2 queries in batch:

```js
GET /graphql?batchOperations=[StoryComments, NewsFeed]

query NewsFeed {
  feed {
    stories {
      id @export(as: "ids")
      actor
      message
    }
  }
}

query StoryComments {
  stories(ids: $ids) {
    comments {
      actor
      message
    }
  }
}
```

In this example `NewsFeed` query would be executed first and all story comments would be loaded in a separate query execution step (`StoryComments`).
This allows client to load all required data with one efficient request to the server, but data would be sent back to the client in chunks.

## Query And Schema Analysis

Sangria provides a lot of generic tools to work with a GraphQL query and schema. Aside from the actual query execution, you may need to
do different things like analyze a query for breaking changes, introspection usage, deprecated field usage, validate query/schema without
executing it, etc. This section describes some of the tools that will help you with these tasks.

### Query Validation

Query validation consists of validation rules. You can pick and choose which rules you would like to use for a query validation. You
can even create your own validation rules and validate queries against them. The list of standard validation rules is available in `QueryValidator.allRules`.
In order to validate queries against the list of rules you need to use `RuleBasedQueryValidator`. The default query validator which uses all standard rules
is available under `QueryValidator.default`. Here is an example of how you can use it:

```scala
val violations = QueryValidator.default.validateQuery(schema, query)
```

You can also customise the list of validation rules when you are executing the query by providing a custom query validator like this:

```scala
Executor.execute(schema, query, queryValidator = ...)
```

For instance, it can be useful to disable validation for production setup, where you have validated all possible queries upfront and would
like to save on CPU cycles during the execution.

Query validation can also be used for SDL validation. Let's say we have following type definitions:

```js
type User @auth(token: "TEST") {
  name: String
  isAdmin: Boolean @permission(name: "ADMIN")
}
```

We can validate it against a stub schema like this:

```scala
val validationSchema =
  Schema.buildStubFromAst(
    gql"""
      directive @permission(name: String) on FIELD_DEFINITION
      directive @auth(token: String!) on OBJECT
    """)

val errors: Vector[Violation] =
  QueryValidator.default.validateQuery(validationSchema,
    gql"""
      type User @auth(token: "TEST") {
        name: String
        isAdmin: Boolean @permission(name: "ADMIN")
      }
    """)
```

If we make a mistake somewhere (misplace the directive or forget to provide a directive argument):

```scala
val errors: Vector[Violation] =
  QueryValidator.default.validateQuery(validationSchema,
    gql"""
      type User @auth {
        name: String @auth(token: "TEST")
        isAdmin: Boolean
      }
    """)
```

we will get following validation errors:

```js
Directive 'auth' may not be used on field definition. (line 3, column 22):
        name: String @auth(token: "TEST")
                     ^

Field 'auth' argument 'token' of type 'String!' is required but not provided. (line 2, column 17):
      type User @auth {
                ^
```

### Input Document Validation

`QueryValidator` also able to validate `InputDocument`. Here is a small example:

```scala
val schema = Schema.buildStubFromAst(
  gql"""
    enum Color {
      RED
      GREEN
      BLUE
    }

    input Foo {
      baz: Color!
    }

    input Config {
      foo: String
      bar: Int
      list: [Foo]
    }
  """)

val inp =
  gqlInpDoc"""
    {
      foo: "bar"
      bar: "foo"
      list: [
        {baz: RED}
        {baz: FOO_BAR}
        {test: 1}
        {}
      ]
    }

    {
      doo: "hello"
    }
  """

val errors = QueryValidator.default.validateInputDocument(schema, inp, "Config")
```

In contrast to standard validation, you also need to provide an input type against which you would like to validate the input
document. Validation will result in following errors:

```js
At path 'bar' Int value expected (line 4, column 13):
            bar: "foo"
            ^

At path 'list[1].baz' Enum value 'FOO_BAR' is undefined in enum type 'Color'. Known values are: RED, GREEN, BLUE. (line 5, column 13):
            list: [
            ^
 (line 5, column 19):
            list: [
                  ^
 (line 7, column 16):
              {baz: FOO_BAR}
               ^

At path 'list[2].test' Field 'test' is not defined in the input type 'Foo'. (line 5, column 13):
            list: [
            ^

...
```

### Schema Validation

Just like query validation, schema validation consists of validation rules. You can pick and choose which rules you would like to use for a schema validation. You
can even create your own validation rules and validate schema against them. The list of standard validation rules is available in `SchemaValidationRule.default`.

You can also customise the list of validation rules when you are creating a schema by providing a custom list of rules like this:

```scala
Schema(QueryType, validationRules = ...)
```

### Verification With Query Reducers

Query reducers provide a lot useful analysis tools, but they require 2 bits of information in addition to a query: `operationName` and `variables`.
Still, you can execute query reducers against query without executing it by using `Executor.prepare`. `prepare` will not execute the query,
but instead it will prepare query for execution ensuring that query is validated and all query reducers are successful.

Here is how you can ensure that query complexity does not exceed the threshold:

```scala
val variables: Json =  ...

val prepared =
  query.operations.keySet.map { operationName =>
    Executor.prepare(schema, query,
      operationName = operationName,
      variables = variables,
      queryReducers =
        QueryReducer.rejectComplexQueries(1000, (_, _) => TooExpansiveQuery)) :: Nil
  }

val validated = Future.sequence(prepared).map(_ => Done)
```

You will need to initialize all required variable values with some stubs. All variable variable values that represent things that potentially
may increase query complexity, like list limits, should be set to values that represent the worst-case scenario (like max limit).

If you don't have the variables or don't want to work with the stub value, then you can use another mechanism that does not require variables.
`QueryReducerExecutor.reduceQueryWithoutVariables` provides a convenient way to achieve this. In its signature it is similar to
`Executor.prepare`, but it does not require `variables` and designed to validate and execute query reducers for queries that are
being analyzed ahead of time (e.g. in the context of persistent queries).

### AstVisitor

`AstVisitor` provides an easy way to traverse and possibly transform all `AstNode`s in a query. Here is how basic usage looks like:

```scala
val queryWithoutComments =
  AstVisitor.visit(query, AstVisitor {
    case _: Comment => VisitorCommand.Delete
  })
```

This visit will create a new query `Document` that does not contain any comments.

`AstVisitor` also provides several variations of `visit` function that allow you to visit AST nodes with type info (from schema definition) and state.

If you would like to analyse field (and all of it's selections/nested fields) inside of a `resolve` function, you can access it with `Context.astFields` and then use
`AstVisitor` to analyse it. You may also consider using [projections feature](#projections) for this.

### Document Analyzer

Sangria provides several high-level tools to analyse AST `Document` without reliance on schema. They are defined in `DocumentAnalyzer`
(which you can also access via `query.analyzer`).

Here is an example of how you can separate query operations:

```scala
val query =
  gql"""
    query One {
      ...A
    }

    query Two {
      foo
      bar
      ...B
      ...C
    }

    fragment A on T {
      field
      ...C
    }

    fragment B on T {
      fieldX
    }

    fragment C on T {
      fieldC
    }
  """

query.analyzer.separateOperations.values.foreach { document =>
  println(document.renderPretty)
}
```

`separateOperations` will create two `Document`s that look like this:

```js
query One {
  ...A
}

fragment A on T {
  field
  ...C
}

fragment C on T {
  fieldC
}
```

and

```js
query Two {
  foo
  bar
  ...B
  ...C
}

fragment B on T {
  fieldX
}

fragment C on T {
  fieldC
}
```

### Schema Based Document Analyzer

While `DocumentAnalyzer` does not rely on a schema information to analyse the query `Document`, `SchemaBasedDocumentAnalyzer` uses schema
provide much deeper query analysis. It can be used to discover things like deprecated field, introspection, variable usage.

Here is an example of how you can find all deprecated field and enum value usages:

```scala
schema.analyzer(query).deprecatedUsages
```

### Schema Comparison

Schema comparator provides an easy way to compare schemas between each other. You can, of course, compare unrelated schemas and get all of the differences as a list.
Where it becomes really useful, is when you compare different versions of the same schema.

In this example I compare a schema loaded from staging environment against the schema from a production environment:

```scala
val prodSchema = Schema.buildFromIntrospection(
  loadSchema("http://prod.my-company.com/graphql"))

val stagingSchema = Schema.buildFromIntrospection(
  loadSchema("http://staging.my-company.com/graphql"))

val changes: Vector[SchemaChange] = stagingSchema compare prodSchema
```

Given this list of changes, we can do a few interesting thing with it. For instance, we can stop the deployment
to production if staging environment contains **breaking changes** (you can run this somewhere in your CI environment):

```scala
val breakingChanges = changes.filter(_.breakingChange)

if (breakingChanges.nonEmpty) {
  val rendered = breakingChanges
    .map(change => s" * ${change.description}")
    .mkString("\n", "\n", "")

  throw new IllegalStateException(
    s"Staging environment has breaking changes in GraphQL schema! $rendered")
}
```

You can also create **release notes** for all of the changes:

```scala
val releaseNotes =
  if (changes.nonEmpty) {
    val rendered = changes
      .map { change =>
        val breaking =
          if(change.breakingChange) " (breaking change)"
          else ""

        s" * ${change.description}$breaking"
      }
      .mkString("\n", "\n", "")

    s"Release Notes: $rendered"
  } else "No Changes"
```

## Stream-based Subscriptions

As described in [previous section](#prepared-queries), you can handle subscription queries with prepared queries.
This approach provides a lot of flexibility, but also means that you need to manually analyze subscription fields and appropriately
execute query for every event.

Stream-based subscriptions provide much easier and, in many respects, superior approach of handling subscription queries.
In order to use it, you first need to choose one of available stream implementations:

- `sangria.streaming.akkaStreams._` - [akka-streams](http://doc.akka.io/docs/akka/current/scala/stream/index.html) implementation based on `Source[T, NotUsed]`
  - `"{{site.groupId}}" %% "sangria-akka-streams" % "{{site.version.sangria-akka-streams}}"`
  - Requires an implicit `akka.stream.Materializer` to be available in scope
- `sangria.streaming.rxscala._` - [RxScala](http://reactivex.io/rxscala) implementation based on `Observable[T]`
  - `"{{site.groupId}}" %% "sangria-rxscala" % "{{site.version.sangria-rxscala}}"`
  - Requires an implicit `scala.concurrent.ExecutionContext` to be available in scope
- `sangria.streaming.monix._` - [monix](https://monix.io) implementation based on `Observable[T]`
  - `"{{site.groupId}}" %% "sangria-monix" % "{{site.version.sangria-monix}}"`
  - Requires an implicit `monix.execution.Scheduler` to be available in scope
- `sangria.streaming.future._` - very simple implementation based on `Future[T]` which is treated as a stream with a single element
  - Requires an implicit `scala.concurrent.ExecutionContext` to be available in scope

You can also easily create your own integration by implementing and providing an implicit instance of `SubscriptionStream[S]` type class.

{% include ext.html type="info" title="Example project" %}
If you prefer a hands-on approach, then you can take a look at [sangria-subscriptions-example](https://github.com/sangria-graphql/sangria-subscriptions-example) project. It demonstrates most of the concepts that are described in this section.
{% include cend.html %}

After you have imported a concrete stream implementation, you can define a subscription type fields with `Field.subs`.
Here is an example that uses monix:

```scala
import monix.execution.Scheduler.Implicits.global
import monix.reactive.Observable
import sangria.streaming.monix._

val SubscriptionType = ObjectType("Subscription", fields[Unit, Unit](
  Field.subs("userEvents", UserEventType, resolve = _ =>
    Observable(UserCreated(1, "Bob"), UserNameChanged(1, "John")).map(action(_))),

  Field.subs("messageEvents", MessageEventType, resolve = _ =>
    Observable(MessagePosted(userId = 20, text = "Hello!")).map(action(_)))
))
```

Please note that every element in a stream should be an `Action[Ctx, Val]`. An `action` helper function is used in this case to
transform every element of a stream into an `Action`. Also, it is important that either all fields of a `SubscriptionType` or none of them are
created with the `Field.subs` function (otherwise it would not be possible to merge them in a single stream).

Now you can execute subscription queries and get back a stream of query execution results like this:

```scala
import monix.execution.Scheduler.Implicits.global
import sangria.streaming.monix._
import sangria.execution.ExecutionScheme.Stream

val schema = Schema(QueryType, subscription = Some(SubscriptionType))

val query =
  graphql"""
    subscription {
      userEvents {
        id
        __typename

        ... on UserCreated {
          name
        }
      }

      messageEvents {
        __typename

        ... on MessagePosted {
          user {
            id
            name
          }

          text
        }
      }
    }
  """

val stream: Observable[JsValue] = Executor.execute(schema, query)
```

We are importing `ExecutionScheme.Stream` to instruct the executor to return a stream of results instead of a `Future` of a single result.
The stream will emit the following elements (the order may be different):

```json
{
  "data": {
    "userEvents": {
      "id": 1,
      "__typename": "UserCreated",
      "name": "Bob"
    }
  }
}

{
  "data": {
    "messageEvents": {
      "__typename": "MessagePosted",
      "user": {
        "id": 20,
        "name": "Test User"
      },
      "text": "Hello!"
    }
  }
}

{
  "data": {
    "userEvents": {
      "id": 1,
      "__typename": "UserNameChanged",
      "name": "John"
    }
  }
}
```

Only the top-level subscription fields have special semantics associated with them (in this respect it is similar to the mutation queries).
The execution engine merges the requested field streams into a single stream which is then returned as a result of the execution.
All other fields (2nd level, 3rd level, etc.) have normal semantics and would be fully resolved.

{% include ext.html type="info" title="Work In Progress" %}
Please note, that the semantics of subscription queries is not standardized or fully defined at the moment. It may change in future, so use this feature with caution.  
{% include cend.html %}

## Deferred Value Resolution

In the example schema, you probably noticed that some of the resolve functions return `DeferFriends`. It is defined like this:

```scala
case class DeferFriends(friends: List[String]) extends Deferred[List[Character]]
```

The defer mechanism allows you to postpone the execution of particular fields and then batch them together in order to optimise object retrieval.
This can be very useful when you want to avoid an N+1 problem. In the example schema all of the characters have a list of friends, but they only have their IDs.
You need to fetch them from somewhere in order to progress query execution.
Retrieving every friend one-by-one would be very inefficient, since you potentially need to access an external database
in order to do so. The defer mechanism allows you to batch all these friend list retrieval requests in one efficient request to the DB.
In order to do it, you need to implement a `DeferredResolver` that will get a list of deferred values:

```scala
class FriendsResolver extends DeferredResolver[Any] {
  def resolve(deferred: Vector[Deferred[Any]], ctx: Any, queryState: Any)(implicit ec: ExecutionContext) =
    // Here goes your resolution logic
}
```

The `resolve` function gives you a list of `Deferred[A]` values and expects you to return a list of resolved values `Future[B]`.

It is important to note that the resulting list must have the same size. This allows an executor to figure out the relation
between deferred values and results. The order of results also plays an important role.
(Fetch API, which is described below, uses `HasId` type class to match the entities, so the contract/restriction only relevant for `DeferredResolver`)

After you have defined a `DeferredResolver[T]`, you can provide it to an executor like this:

```scala
Executor.execute(schema, query, deferredResolver = new FriendsResolver)
```

`DeferredResolver` will do its best to batch as many deferred values as possible. Let's look at this example query to see how it works:

```js
{
  hero {
    friends {
      friends {
        friends {
          friends {
            name
          }
        }
      }

      more: friends {
        friends {
          friends {
            name
          }
        }
      }
    }
  }
}
```

During an execution of this query, the amount of produced `Deferred` values grows exponentially. Still `DeferredResolver.resolve` method
would be called only **4** times by the executor because the query has only 4 levels of fields that return deferred values (`friends` in this case).

### Transforming the Deferred Value

It is quite common requirement to transform the resolved deferred value before it is used by the execution engine. This can be easily achieved
with `map` method on the `DeferredValue` action. here is an example:

```scala
Field("products", ListType(ProductType),
  resolve = c =>
    DeferredValue(fetcherProd.deferSeqOpt(c.value.products))
      .map(fetchedProducts => ...)),
```

In some cases you need to report errors that happened during deferred value resolution, but still preserving successful result. You can do
it by using `mapWithErrors` instead of `map`.

Functions like `defer` or `deferSeq` will trigger internal errors if one of the deferred values cannot be resolved (tags with id `1`, `2`, and `3` are requested but the deferred resolver only returns tags with id `1` and `3` for example), whereas their `Opt` counterparts (`deferOpt`, `deferSeqOpt`, etc.), although having the same signatures, will ignore the missing values silently.

### DeferredResolver State

In some cases you may need to have some state inside of a `DeferredResolver` for every query execution. This, for instance, is necessary when you
implement a cache inside of the resolver.

Internally, an executor manages `DeferredResolver` state and provides it via the `queryState` argument to a `resolve` method. You can provide an initial
state by overriding the `initialQueryState` method:

```scala
class MyResolver[Ctx] extends DeferredResolver[Ctx] {
  def initialQueryState: Any = TrieMap[String, Any]()

  def resolve(deferred: Vector[Deferred[Any]], ctx: Ctx, queryState: Any)(implicit ec: ExecutionContext) =
    // resolve deferred values by using cache from `queryState`
}
```

### Customizing DeferredResolver Behaviour

As was mentioned before, `DeferredResolver` will do its best to collect and batch as many `Deferred` values as possible. This means that it
will even wait for a `Future` to produce some values in order to find out whether they produce some deferred values.

In some cases this is not desired. You can override the following methods in order to customize this behaviour and define independent
deferred value groups:

- `includeDeferredFromField` - A function that decides whether deferred values from a particular field should be collected or processed independently.
- `groupDeferred` - Provides a way to group deferred values in batches that would be processed independently. Useful for separating cheap and expensive deferred values.

### High-level Fetch API

`DeferredResolver` provides a very flexible mechanism to batch retrieval of objects from the external services or databases, but it provides a
very low-level, unsafe, but efficient API for this. You certainly can use it directly, especially in more non-trivial cases, but most of the time
you probably will work with isolated entity objects which you would like to load by ID or some relation to other entities. This is where `Fetcher`
comes into play.

`Fetcher` provides a high-level API for deferred value resolution and is implemented as a specialized version of `DeferredResolver`.
This API provides the following features:

- Deferred value resolution based on entity IDs
- Deferred value resolution based on entity relations
- Deduplication of the entities based on the ID
- Caching support
- Support for `maxBatchSize`
- Supports a fallback to an existing `DeferredResolver`

Examples in this section will use the following data model of products and categories:

<div class="example-tables">
  <div class="left-table">
    <span class="table-title">Products</span>
    <table>
      <thead><tr>
        <th>ID</th>
        <th>Name</th>
      </tr></thead>
      <tbody>
        <tr>
          <td>1</td>
          <td>Rusty sword</td>
        </tr>
        <tr>
          <td>2</td>
          <td>Health potion</td>
        </tr>
        <tr>
          <td>3</td>
          <td>Small mana potion</td>
        </tr>
      </tbody>
    </table>
  </div>
  <div class="right-table">
    <span class="table-title">Categories</span>
    <table>
      <thead><tr>
        <th>ID</th>
        <th>Name</th>
        <th>Parent</th>
        <th>Products</th>
      </tr></thead>
      <tbody>
        <tr>
          <td>1</td>
          <td>Root</td>
          <td></td>
          <td></td>
        </tr>
        <tr>
          <td>2</td>
          <td>Equipment</td>
          <td>1</td>
          <td>[1]</td>
        </tr>
        <tr>
          <td>3</td>
          <td>Potions</td>
          <td>1</td>
          <td>[2, 3]</td>
        </tr>
      </tbody>
    </table>
  </div>
</div>

As you can see, the product table (which also can be a document in a document DB or just JSON which is returned from an external service call)
just has product information. Category, on the the other hand, also contains 2 relations - to the products within this category and to a parent category.
First let's look at how we can fetch entities by ID, and then we will look at how we can use a relation information for this.

First of all you need to define a Fetcher:

```scala
val products =
  Fetcher((ctx: MyCtx, ids: Seq[Int]) =>
    ctx.loadProductsById(ids))

val categories =
  Fetcher((ctx: MyCtx, ids: Seq[Int]) =>
    ctx.loadCategoriesById(ids))
```

Now you should be able to define a `DeferredResolver` based on these fetchers:

```scala
val resolver: DeferredResolver[MyCtx] =
  DeferredResolver.fetchers(products, categories)
```

Every time you need to load a particular entity by ID, you can use the fetcher to create a `Deferred` value for you:

```scala
Field("category", CategoryType,
  arguments = Argument("id", IntType) :: Nil,
  resolve = c => categories.defer(c.arg[Int]("id")))

Field("categoryMaybe", OptionType(CategoryType),
  arguments = Argument("id", IntType) :: Nil,
  resolve = c => categories.deferOpt(c.arg[Int]("id")))

Field("productsWithinCategory", ListType(ProductType),
  resolve = c => categories.deferSeqOpt(c.value.products))
```

The deferred resolution mechanism will take care of the rest and will fetch products and categories in the most efficient way.

#### Transforming Fetched Entities with `DeferredValue`

Fetched entities can be further transformed as part of the deferred resolution
mechanism by wrapping the deferred value in `DeferredValue` and using its `map`
method.

```scala
Field("categoryName", OptionType(StringType),
  resolve = c => DeferredValue(categories.deferOpt(c.value.categoryId)).map(_.name))
```

#### HasId Type Class

In order to extract the ID from entities, the Fetch API uses the `HasId` type class:

```scala
case class Product(id: String, name: String)

object Product {
  implicit val hasId = HasId[Product, String](_.id)
}
```

If you don't want to define an implicit instance, you can also provide it directly to the fetcher like this:

```scala
Fetcher((ctx: MyCtx, ids: Seq[String]) => ctx.loadProductsById(ids))(HasId(_.id))
```

#### Fetching Relations

The Fetch API is also able to fetch entities based on their relation to other entities. In our example category has 2 relations, so let's define these relations:

```scala
val byParent = Relation[Category, Int]("byParent", c => Seq(c.parent))
val byProduct = Relation[Category, Int]("byProduct", c => c.products)
```

You need to use `Fetcher.rel` to define a `Fetcher` that supports relations:

```scala
val categories = Fetcher.rel(
  (repo, ids) => repo.loadCategories(ids),
  (repo, ids) => repo.loadCategoriesByRelation(ids))
```

In case of relation batch function `ids` would be of type `RelationIds[Res]` which contains the list of IDs for every relation type.

Now you should be able to use the category fetcher to create `Deferred` values like this:

```scala
Field("categoriesByProduct", ListType(CategoryType),
  arguments = Argument("productId", IntType) :: Nil,
  resolve = c => categories.deferRelSeq(byProduct, c.arg[Int]("productId")))

Field("categoryChildren", ListType(CategoryType),
  resolve = c => categories.deferRelSeq(byParent, c.value.id))
```

#### Caching

The Fetch API supports caching. You just need to define a fetcher with `Fetcher.caching` or `relCaching` and all of the entities will be cached on a per-query basis.
This means that every query execution gets its own isolated cache instance.

You can provide an alternative cache implementation via `FetcherConfig`:

```scala
val cache = FetcherCache.simple

val categories = Fetcher(
  config = FetcherConfig.caching(cache),
  fetch = (ctx, ids) => ctx.loadCategoriesById(ids))
```

The `FetcherCache` will cache not only the entities themselves, but also relation information between entities.

#### Limiting Batch Size

In some cases you may want to split bigger batches into a set of batches of particular size. You can do this by providing an appropriate `FetcherConfig`:

```scala
val cache = FetcherCache.simple

val categories = Fetcher(
  config = FetcherConfig.maxBatchSize(10),
  fetch = (repo, ids) => repo.loadCategories(ids))
```

#### Fallback to Existing DeferredResolver

If you already have an existing `DeferredResolver`, you can still use it in combination with fetchers:

```scala
DeferredResolver.fetchersWithFallback(new ExitingDeferredResolver, products, categoies)
```

The `includeDeferredFromField` and `groupDeferred` would always be delegated to a fallback.

## Protection Against Malicious Queries

GraphQL is a very flexible data query language. Unfortunately with flexibility comes also a danger of misuse by malicious clients.
Since typical GraphQL schemas contain recursive types and circular dependencies, clients are able to send infinitely deep queries
which may have high impact on server performance. That's because it's important to analyze query complexity before executing it.
Sangria provides two mechanisms to protect your GraphQL server from malicious or expensive queries which are described in the next sections.

### Query Complexity Analysis

Query complexity analysis makes a rough estimation of the query complexity before it is executed. The complexity is a `Double` number that is
calculated according to the simple rule described below.

Every field in the query gets a default score `1` (including `ObjectType` nodes). The "complexity" of the query is the sum of all field scores.

So the following instance query:

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

will have complexity `6`. You probably noticed, that score is a bit unfair since the `pets` field is actually a list which can contain a max of 20
elements in the response.

You can customize the field score with a `complexity` argument in order to solve these kinds of issues:

```scala
Field("pets", OptionType(ListType(PetType)),
  arguments = Argument("limit", IntType) :: Nil,
  complexity = Some((ctx, args, childScore) => 25.0D + args.arg[Int]("limit") * childScore),
  resolve = ctx => ...)
```

Now the query will get a score of `68` which is a much better estimation.

In order to analyze the complexity of a query, you need to add a corresponding `QueryReducer` to the `Executor`.
In this example `rejectComplexQueries` will reject all queries with complexity higher than `1000`:

```scala
val rejectComplexQueries = QueryReducer.rejectComplexQueries[Any](1000, (c, ctx) =>
  new IllegalArgumentException(s"Too complex query"))

Executor.execute(schema, query, queryReducers = rejectComplexQueries :: Nil)
```

If you just want to estimate the complexity and then perform different actions, then there is another helper function for this:

```scala
val complReducer = QueryReducer.measureComplexity[MyCtx] { (c, ctx) =>
  // do some analysis
  ctx
}
```

The complexity of a full introspection query (used by tools like GraphiQL) is around `100`.

### Limiting Query Depth

There is also another simpler mechanism to protect against malicious queries: limiting query depth. It can be done by providing
the `maxQueryDepth` argument to the `Executor`:

```scala
val executor = Executor(schema = MySchema, maxQueryDepth = Some(7))
```

## Error Handling

Bad things can happen during the query execution. When errors happen, then `Future` would be resolved with some exception. Sangria allows you to distinguish between different types of errors that happen before actual query execution:

- `QueryReducingError` - an error happened in the query reducer. If you are throwing some exceptions within a custom `QueryReducer`, then they would be wrapped in `QueryReducingError`
- `QueryAnalysisError` - signifies issues in the query or variables. This means that client has made some error. If you are exposing a GraphQL HTTP endpoint, then you may want to return a 400 status code in this case.
- `ErrorWithResolver` - unexpected errors before query execution

All mentioned, exception classes expose a `resolveError` method which you can use to render an error in GraphQL-compliant format.

Let's see how you can handle these error in a small example. In most cases it makes a lot of sense to return a 400 HTTP status code if the query validation failed:

```scala
executor.execute(query, ...)
  .map(Ok(_))
  .recover {
    case error: QueryAnalysisError => BadRequest(error.resolveError)
    case error: ErrorWithResolver => InternalServerError(error.resolveError)
  }
```

This code will produce status code 400 in case of any error caused by client (query validation, invalid operation name, error in query reducer, etc.).

### Custom ExceptionHandler

When some unexpected error happens in the `resolve` function, sangria handles it according to the [rules defined in the spec]({{site.link.spec.errors}}).
If an exception implements the `UserFacingError` trait, then the error message would be visible in the response.
Otherwise the error message is obfuscated and the response will contain `"Internal server error"`.

In order to define custom error handling mechanisms, you need to provide an `ExceptionHandler` to `Executor`. Here is an example:

```scala
val exceptionHandler = ExceptionHandler {
  case (m, e: IllegalStateException) => HandledException(e.getMessage)
}

Executor(schema, exceptionHandler = exceptionHandler).execute(doc)
```

This example provides an error `message` (which would be shown instead of "Internal server error").

You can also add additional fields in the error object like this:

```scala
val exceptionHandler = ExceptionHandler {
  case (m, e: IllegalStateException) =>
    HandledException(e.getMessage,
      Map(
      "foo" -> m.arrayNode(Seq(
        m.scalarNode("bar", "String", Set.empty),
        m.scalarNode("1234", "Int", Set.empty))),
      "baz" -> m.scalarNode("Test", "String", Set.empty)))
}
```

You can also provide a list of handled errors to `HandledException`. This will result in several error elements in the execution result.

In addition to handling errors coming from `resolve` function, `ExceptionHandler` also allows to handle `Violation`s and `UserFacingError`s:

- `onException` - all unexpected exceptions coming from the `resolve` functions
- `onViolation` - handles violations (things like validation errors, argument/variable coercion, etc.)
- `onUserFacingError` - handles standard sangria errors (errors like invalid operation name, max query depth, etc.)

Here is an example if handling a violation, changing the message and adding extra fields:

```scala
val exceptionHandler = ExceptionHandler (onViolation = {
  case (m, v: UndefinedFieldViolation) =>
    HandledException("Field is missing!!! D:",
      Map(
        "fieldName" -> m.scalarNode(v.fieldName, "String", Set.empty),
        "errorCode" -> m.scalarNode("OOPS", "String", Set.empty)))
})
```

## Result Marshalling and Input Unmarshalling

GraphQL query execution needs to know how to serialize the result of execution and how to deserialize arguments/variables.
The specification itself does not define the data format, instead it uses abstract concepts like map and list.
Sangria does not hard-code the serialization mechanism. Instead it provides two traits for this:

- `ResultMarshaller` - knows how to serialize results of execution
- `InputUnmarshaller[Node]` - knows how to deserialize the arguments/variables

At the moment Sangria provides implementations for these libraries:

- `sangria.marshalling.queryAst._` - native Query Value AST serialization
- `sangria.marshalling.sprayJson._` - spray-json serialization
  - `"{{site.groupId}}" %% "sangria-spray-json" % "{{site.version.sangria-spray-json}}"`
- `sangria.marshalling.playJson._` - play-json serialization
  - `"{{site.groupId}}" %% "sangria-play-json" % "{{site.version.sangria-play-json}}"`
- `sangria.marshalling.circe._` - circe serialization
  - `"{{site.groupId}}" %% "sangria-circe" % "{{site.version.sangria-circe}}"`
- `sangria.marshalling.argonaut._` - argonaut serialization
  - `"{{site.groupId}}" %% "sangria-argonaut" % "{{site.version.sangria-argonaut}}"`
- `sangria.marshalling.json4s.native._` - json4s-native serialization
  - `"{{site.groupId}}" %% "sangria-json4s-native" % "{{site.version.sangria-json4s-native}}"`
- `sangria.marshalling.json4s.jackson._` - json4s-jackson serialization
  - `"{{site.groupId}}" %% "sangria-json4s-jackson" % "{{site.version.sangria-json4s-jackson}}"`
- `sangria.marshalling.msgpack._` - [MessagePack](http://msgpack.org/) serialization
  - `"{{site.groupId}}" %% "sangria-msgpack" % "{{site.version.sangria-msgpack}}"`
- `sangria.marshalling.ion._` - [Amazon Ion](http://amznlabs.github.io/ion-docs/index.html) serialization
  - `"{{site.groupId}}" %% "sangria-ion" % "{{site.version.sangria-ion}}"`

In order to use one of these, just import it and the result of execution will be of the correct type:

```scala
import sangria.marshalling.sprayJson._

val result: Future[JsValue] = Executor.execute(TestSchema.StarWarsSchema, queryAst,
  variables = vars
  userContext = new CharacterRepo,
  deferredResolver = new FriendsResolver)
```

### ToInput Type-Class

Default values should now have an instance of the `ToInput` type-class which is defined for all supported input types like Scala map-like data structures, different JSON ASTs, etc. It even supports things like `Writes` from play-json or `JsonFormat` from spray-json by default. This means that you can use your domain objects (like `User` or `Apple`) as a default value for input fields or arguments as long as you have `Writes` or `JsonFormat` defined for them.

The mechanism is very extensible: you just need to define an implicit `ToInput[T]` for a class you want to use as a default value.

### FromInput Type-Class

`FromInput` provides high-level and low-level ways to deserialize arbitrary input objects, just like `ToInput`.

In order to use this feature, you need to provide a type parameter to the `InputObjectType`:

```scala
case class Article(title: String, text: Option[String])

val ArticleType = InputObjectType[Article]("Article", List(
  InputField("title", StringType),
  InputField("text", OptionInputType(StringType))))

val arg = Argument("article", ArticleType)
```

This code will not compile unless you define an implicit instance of `FromInput` for the `Article` case class:

```scala
implicit val manual = new FromInput[Article] {
  val marshaller = CoercedScalaResultMarshaller.default
  def fromResult(node: marshaller.Node) = {
    val ad = node.asInstanceOf[Map[String, Any]]

    Article(
      title = ad("title").asInstanceOf[String],
      text = ad.get("text").flatMap(_.asInstanceOf[Option[String]])
    )
  }
}
```

As you can see, you need to provide a `ResultMarshaller` for the desired format and then use a marshaled value to create a domain object based on it. Many instances of `FromInput` are already provided out-of-the-box. For instance `FromInput[Map[String, Any]]` supports map-like data-structure format. All supported JSON libraries also provide `FromInput[JsValue]` so that you can use JSON AST instead of working with `Map[String, Any]`.

Moreover, libraries like sangria-play-json and sangria-spray-json already provide support for codecs like `Reads` and `JsonFormat`.
This means that your domain objects are automatically supported as long as you have `Reads` or `JsonFormat` defined for them.
For instance, this example should compile and work just fine without an explicit `FromInput` declaration:

```scala
import sangria.marshalling.playJson._
import play.api.libs.json._

case class Article(title: String, text: Option[String])

implicit val articleFormat = Json.format[Article]

val ArticleType = InputObjectType[Article]("Article", List(
  InputField("title", StringType),
  InputField("text", OptionInputType(StringType))))

val arg = Argument("article", ArticleType)
```

### Query AST Marshalling

A subset of GraphQL grammar that handles input object is also available as a standalone feature. You can read more about it in a following blog post:

[GraphQL Object Notation](https://medium.com/@oleg.ilyenko/graphql-object-notation-8f56194556ea)

This feature allows you to parse and render any `ast.Value` independently from GraphQL query. You can also use `graphqlInput` macros for this:

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

It will produce the following output:

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

Proper `InputUnmarshaller` and `ResultMarshaller` are available for it, so you can use `ast.Value` as a variable or as a result
of GraphQL query execution.

In addition to parsing, you can also deserialize an `InputDocument` based on the `FromInput` type class. Here is an example:

```scala
case class Comment(author: String, text: Option[String])
case class Article(title: String, text: Option[String], tags: Option[Vector[String]], comments: Vector[Option[Comment]])

val ArticleType: InputObjectType[Article] = ???

val document = QueryParser.parseInputDocumentWithVariables(
  """
    {
      title: "foo",
      tags: null,
      comments: []
    }

    {
      title: "Article 2",
      text: "contents 2",
      tags: ["spring", "guitars"],
      comments: [{
        author: "Me"
        text: $comm
      }]
    }
  """)

val vars = scalaInput(Map(
  "comm" -> "from variable"
))

val articles: Vector[Article] = document.to(ArticleType, vars)
```

as a result of this deserialization, you will get following list of `articles`:

```scala
Vector(
  Article("foo", Some("Hello World!"), None, Vector.empty),
  Article("Article 2", Some("contents 2"),
    Some(Vector("spring", "guitars")),
    Vector(Some(Comment("Me", Some("from variable"))))))
```

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
  Json.array(Json.obj("foo" -> Json.string("bar"))))

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

Sangria supports generic middleware that can be used for different purposes, like performance measurement, metrics collection, security enforcement, etc. on a field and query level.
Moreover it makes it much easier for people to share standard middleware in libraries. Middleware allows you to define callbacks before/after query and field.

Here is a small example of its usage:

```scala
class FieldMetrics extends Middleware[Any] with MiddlewareAfterField[Any] with MiddlewareErrorField[Any] {
  type QueryVal = TrieMap[String, List[Long]]
  type FieldVal = Long

  def beforeQuery(context: MiddlewareQueryContext[Any, _, _]) = TrieMap()
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

It will record the execution time of all fields in a query and then report it in some way.

Middleware supports 2 types state that you can use within a middleware instance:

- `QueryVal` - an instance of this type is create at the beginning of the query execution and then propagated to all other middleware methods
- `FieldVal` - an instance of this type may be returned from `beforeField` and will be given as a argument to `afterField` and `fieldError` for the same field.

These two types of state provide a way to avoid shared mutable state in case some intermediate value need to be propagated between different
methods of middleware.

`afterField` also allows you to transform field values by returning `Some` with a transformed value. You can also throw an exception from `beforeField` or `afterField`
in order to indicate a field error.

`beforeField` returns `BeforeFieldResult` which allows you to add a `MiddlewareAttachment`.
This attachment then can be used in resolve function via `Context.attachment`/`Context.attachments`.

In case several middleware objects are defined for the same execution, `beforeField` would be called in the order middleware is defined.
`afterField`, on the other hand, would be call in reverse order. To demonstrate this, let's look at this middleware as an example:

```scala
case class Suffixer(suffix: String) extends Middleware[Any] with MiddlewareAfterField[Any] {
 type QueryVal = Unit
 type FieldVal = Unit

 def beforeQuery(context: MiddlewareQueryContext[Any, _, _]) = ()
 def afterQuery(queryVal: QueryVal, context: MiddlewareQueryContext[Any, _, _]) = ()
 def beforeField(cache: QueryVal, mctx: MiddlewareQueryContext[Any, _, _], ctx: Context[Any, _]) = continue

 def afterField(cache: QueryVal, fromCache: FieldVal, value: Any, mctx: MiddlewareQueryContext[Any, _, _], ctx: Context[Any, _]) =
   value match {
     case s: String => Some(s + suffix)
     case _ => None
   }
}
```

it just adds a suffix to a string. When some field in a schema returns value `"v"` and we execute query like this:

```scala
Executor.execute(schema, query, middleware = Suffixer(" s1") :: Suffixer(" s2") :: Nil)
```

Then the result would be `"v s2 s1"`. Here is diagram that shows how different middleware methods are called:

![Middleware execution order]({{"/assets/img/middleware.svg" | prepend: site.baseurl}})

In order to ensure generic classification of fields, every field contains a generic list or `FieldTag`s which provides a user-defined
meta-information about this field (just to highlight a few examples: `Permission("ViewOrders")`, `Authorized`, `Measured`, `Cached`, etc.).
You can find another example of `FieldTag` and `Middleware` usage in [Authentication and Authorisation](#authentication-and-authorisation) section.

### Middleware Extensions

GraphQL spec allows [free-form extensions](https://facebook.github.io/graphql/#sec-Response-Format) to be added in the GraphQL response.
These are quite useful for things like debug and profiling information, for example. Sangria provides a special middleware trait
`MiddlewareExtension` which provides an easy way for `Middleware` to add extensions in the GraphQL response.

Here is an example of a very simple middleware that adds a formatted query in the response:

```scala
object Formatted extends Middleware[Any] with MiddlewareExtension[Any] {
  type QueryVal = Unit
  def beforeQuery(context: MiddlewareQueryContext[Any, _, _]) = ()
  def afterQuery(queryVal: QueryVal, context: MiddlewareQueryContext[Any, _, _]) = ()

  def afterQueryExtensions(
    queryVal: QueryVal,
    context: MiddlewareQueryContext[Any, _, _]
  ): Vector[Extension[_]] = {
    import sangria.marshalling.queryAst._

    Vector(Extension(
      ObjectValue(Vector(
        ObjectField("formattedQuery",
          StringValue(context.queryAst.renderPretty)))): Value))
  }
}
```

Now you can use it by just adding it in the list of middleware during the execution:

```scala
Executor.execute(schema, query, middleware = Formatted :: Nil)
```

Here is an example of execution result JSON:

```json
{
  "data": {
    "human": {
      "name": "Luke Skywalker"
    }
  },
  "extensions": {
    "formattedQuery": "{\n  human(id: \"1000\") {\n    name\n  }\n}"
  }
}
```

### Profiling GraphQL Query Execution

With middleware, Sangria provides a very convenient way to instrument GraphQL query execution and introduce profiling logic. Out-of-the-box
Sangria provides a simple mechanism to log slow queries and show profiling information. To use it, your need to add `sangria-slowlog` dependency:

```scala
libraryDependencies += "{{site.groupId}}" %% "sangria-slowlog" % "{{site.version.sangria-slowlog}}"
```

Library provides a middleware that logs instrumented query information if execution exceeds specific threshold. An example:

```scala
import sangria.slowlog.SlowLog
import scala.concurrent.duration._

Executor.execute(schema, query,
  middleware = SlowLog(logger, threshold = 10 seconds) :: Nil)
```

If query execution takes more than 10 seconds to execute, then you will see similar info in the logs:

```bash
# [Execution Metrics] duration: 12362ms, validation: 0ms, reducers: 0ms
#
# $id = "1000"
query Test($id: String!) {
  # [Query] count: 1, time: 2ms
  #
  # $id = "1000"
  human(id: $id) {
    # [Human] count: 1, time: 0ms
    name

    # [Human] count: 1, time: 11916ms
    appearsIn

    # [Human] count: 1, time: 358ms
    friends {
      # [Droid] count: 2, min: 0ms, max: 0ms, mean: 0ms, p75: 0ms, p95: 0ms, p99: 0ms
      # [Human] count: 2, min: 0ms, max: 0ms, mean: 0ms, p75: 0ms, p95: 0ms, p99: 0ms
      name
    }
  }
}
```

`sangria-slowlog` has full support for GraphQL fragments and polymorphic types, so you will always see metrics for concrete types.

In addition to logging, `sangria-slowlog` also supports graphql extensions. Extensions will add a profiling info in the response under
`extensions` top-level field. In the most basic form, you can use it like this (this approach also disables the logging):

```scala
Executor.execute(schema, query, middleware = SlowLog.extension :: Nil)
```

After middleware is added, you will see following JSON in the response:

```json
{
  "data": {
    "human": {
      "name": "Luke Skywalker",
      "appearsIn": ["NEWHOPE", "EMPIRE", "JEDI"],
      "friends": [
        { "name": "Han Solo" },
        { "name": "Leia Organa" },
        { "name": "C-3PO" },
        { "name": "R2-D2" }
      ]
    }
  },
  "extensions": {
    "metrics": {
      "executionMs": 362,
      "validationMs": 0,
      "reducersMs": 0,
      "query": "# [Execution Metrics] duration: 362ms, validation: 0ms, reducers: 0ms\n#\n# $id = \"1000\"\nquery Test($id: String!) {\n  # [Query] count: 1, time: 2ms\n  #\n  # $id = \"1000\"\n  human(id: $id) {\n    # [Human] count: 1, time: 0ms\n    name\n\n    # [Human] count: 1, time: 216ms\n    appearsIn\n\n    # [Human] count: 1, time: 358ms\n    friends {\n      # [Droid] count: 2, min: 0ms, max: 0ms, mean: 0ms, p75: 0ms, p95: 0ms, p99: 0ms\n      # [Human] count: 2, min: 0ms, max: 0ms, mean: 0ms, p75: 0ms, p95: 0ms, p99: 0ms\n      name\n    }\n  }\n}",
      "types": {
        "Human": {
          "friends": {
            "count": 1,
            "minMs": 358,
            "maxMs": 358,
            "meanMs": 358,
            "p75Ms": 358,
            "p95Ms": 358,
            "p99Ms": 358
          },
          "appearsIn": {
            "count": 1,
            "minMs": 216,
            "maxMs": 216,
            "meanMs": 216,
            "p75Ms": 216,
            "p95Ms": 216,
            "p99Ms": 216
          },
          "name": {
            "count": 3,
            "minMs": 0,
            "maxMs": 0,
            "meanMs": 0,
            "p75Ms": 0,
            "p95Ms": 0,
            "p99Ms": 0
          }
        },
        "Query": {
          "human": {
            "count": 1,
            "minMs": 2,
            "maxMs": 2,
            "meanMs": 2,
            "p75Ms": 2,
            "p95Ms": 2,
            "p99Ms": 2
          }
        },
        "Droid": {
          "name": {
            "count": 2,
            "minMs": 0,
            "maxMs": 0,
            "meanMs": 0,
            "p75Ms": 0,
            "p95Ms": 0,
            "p99Ms": 0
          }
        }
      }
    }
  }
}
```

All `SlowLog` methods accept `addExtentions` argument which allows you to include these extensions along the way.

With a small tweaking, you can also include "Profile" button in GraphiQL. On the server you just need to conditionally include
`SlowLog.extension` middleware to make it work. Here is an example of how this integration might look like:

{% include video-simple.html id="OMa3SXC2mjA" title="Example of interactive GraphQL profiling" %}

## Query Reducers

Sometimes it can be helpful to perform some analysis on a query before executing it. An example is complexity analysis: it aggregates the complexity
of all fields in the query and then rejects the query without executing it if complexity is too high. Another example is gathering all `Permission`
field tags and then fetching extra user auth data from an external service if query contains protected fields. This need to be done before the query
starts to execute.

Sangria provides a mechanism for this kind of query analysis with `QueryReducer`. The query reducer implementation will go through all of the fields
in the query and aggregate them to a single value. `Executor` will then call `reduceCtx` with this aggregated value which gives you an
opportunity to perform some logic and update the `Ctx` before query is executed.

Out-of-the-box sangria comes with several `QueryReducer`s for common use-cases:

- `QueryReducer.measureComplexity` - measures a complexity of the query
- `QueryReducer.rejectComplexQueries` - rejects queries with complexity above provided threshold
- `QueryReducer.collectTags` - collects `FieldTag`s based on a partial function
- `QueryReducer.measureDepth` - measures max query depth
- `QueryReducer.rejectMaxDepth` - rejects queries that are deeper than provided threshold
- `QueryReducer.hasIntrospection` - verifies whether query contains an introspection fields
- `QueryReducer.rejectIntrospection` - rejects queries that contain an introspection fields. This may be useful for production environments where introspection can potentially be abused.

Here is a small example of `QueryReducer.collectTags`:

```scala
val fetchUserProfile = QueryReducer.collectTags[MyContext, String] {
  case Permission(name) => name
} { (permissionNames, ctx) =>
  if (permissionNames.nonEmpty) {
    val userProfile: Future[UserProfile] = externalService.getUserProfile()

    userProfile.map(profile => ctx.copy(profile = Some(profile))
  } else
    ctx
}

Executor.execute(schema, query,
  userContext = new MyContext,
  queryReducers = fetchUserProfile :: Nil)
```

This allows you to avoid fetching a user profile if it's not needed based on the query fields. You can find more information about the `QueryReducer`
that analyses query complexity in the [Query Complexity Analysis](#query-complexity-analysis) section.

## Scalar Types

Sangria supports all standard GraphQL scalars like `String`, `Int`, `ID`, etc. In addition, sangria introduces the following built-in scalar types:

- `Long` - a 64 bit integer value which is represented as a `Long` in Scala code
- `BigInt` - similar to `Int` scalar values, but allows you to transfer big integer values and represents them in code as Scala's `BigInt` class
- `BigDecimal` - similar to `Float` scalar values, but allows you to transfer big decimal values and represents them in code as Scala's `BigDecimal` class

### Custom Scalar Types

You can also create your own custom scalar types. The input and output of scalar types should always be a value that the GraphQL grammar supports, like string,
number, boolean, etc. Here is an example of a `DateTime` (from joda-time) scalar type implementation:

```scala
case object DateCoercionViolation extends ValueCoercionViolation("Date value expected")

def parseDate(s: String) = Try(new DateTime(s, DateTimeZone.UTC)) match {
  case Success(date) => Right(date)
  case Failure(_) => Left(DateCoercionViolation)
}

val DateTimeType = ScalarType[DateTime]("DateTime",
  coerceOutput = (d, caps) =>
    if (caps.contains(DateSupport)) d.toDate
    else ISODateTimeFormat.dateTime().print(d),
  coerceUserInput = {
    case s: String => parseDate(s)
    case _ => Left(DateCoercionViolation)
  },
  coerceInput = {
    case ast.StringValue(s, _, _, _, _) => parseDate(s)
    case _ => Left(DateCoercionViolation)
  })
```

Some marshalling formats natively support `java.util.Date`, so we check for marshaller capabilities here and either return a `Date` or
a `String` in ISO format.

### Scalar Type Alias

Sometime you want to use a standard scalar type, but add a validation on top of it which may be also represented by different scala type.
Example can be a `UserId` value class that represent a `String`-based user ID or `Int Refined Positive` from [refined scala library](https://github.com/fthomas/refined).

This is exactly what scalar aliases allow you to do. Here is how you can define a scalar alias for mentioned scenarios:

```scala
implicit val UserIdType = ScalarAlias[UserId, String](
  StringType, _.id, id => Right(UserId(id)))

implicit val PositiveIntType = ScalarAlias[Int Refined Positive, Int](
  IntType, _.value, i => refineV[Positive](i).left.map(RefineViolation))
```

You can use `UserIdType` and `PositiveIntType` in all places where you can use a scalar types. In introspection results they would be seen as
just `String` and `Int`, but behind the scenes values would be validated and transformed in correspondent scala types.

## Deprecation Tracking

GraphQL schema allows you to declare fields and enum values as deprecated. When you execute a query, you can provide your custom implementation of the
`DeprecationTracker` trait to the `Executor` in order to track deprecated fields and enum values (you can, for instance, log all usages or send metrics to graphite):

```scala
trait DeprecationTracker {
  def deprecatedFieldUsed[Ctx](ctx: Context[Ctx, _]): Unit
  def deprecatedEnumValueUsed[T, Ctx](enum: EnumType[T], value: T, userContext: Ctx): Unit
}
```

## Authentication and Authorisation

Even though sangria does not provide security primitives explicitly, it's pretty straightforward to implement it in different ways. It's a pretty common
requirement of modern web-applications, so this section was written to demonstrate several possible approaches of handling authentication and authorisation.

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

In order to indicate an auth error, we need to define some exceptions:

```scala
case class AuthenticationException(message: String) extends Exception(message)
case class AuthorisationException(message: String) extends Exception(message)
```

We also want the user to see proper error messages in a response, so let's define an error handler for this:

```scala
val errorHandler = ExceptionHandler {
  case (m, AuthenticationException(message)) => HandledException(message)
  case (m, AuthorisationException(message)) => HandledException(message)
}
```

Now that we defined a base for a secure application, let's create a context class, which will provide GraphQL schema with all necessary helper functions:

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

As a last step, we need to define a schema. You can do it in two different ways:

- Auth can be enforced in the `resolve` function itself
- You can use `Middleware` and `FieldTag`s to ensure that user has permissions to access fields

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

As you can see on this example, we are using context object to authorise user with the `authorised` function. An interesting thing to notice
here is that the `login` field uses the `UpdateCtx` action in order make login information available for sibling mutation fields. This makes queries
like this possible:

```js
mutation LoginAndMutate {
  login(userName: "admin", password: "secret")

  withMagenta: addColor(color: "magenta")
  withOrange: addColor(color: "orange")
}
```

Here we login and add colors in the same GraphQL query. It will produce a result like this one:

```json
{
  "data": {
    "login": "a4d7fc91-e490-446e-9d4c-90b5bb22e51d",
    "withMagenta": ["red", "green", "blue", "magenta"],
    "withOrange": ["red", "green", "blue", "magenta", "orange"]
  }
}
```

If the user does not have sufficient permissions, they will see a result like this:

```json
{
  "data": {
    "me": {
      "userName": "john",
      "permissions": null
    },
    "colors": ["red", "green", "blue"]
  },
  "errors": [
    {
      "message": "You do not have permission to do this operation",
      "field": "me.permissions",
      "locations": [
        {
          "line": 3,
          "column": 25
        }
      ]
    }
  ]
}
```

### Middleware-Based Auth

An alternative approach is to use middleware. This can provide a more declarative way to define field permissions.

First let's define `FieldTag`s:

```scala
case object Authorised extends FieldTag
case class Permission(name: String) extends FieldTag
```

This allows us to define a schema like this:

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

## GraphQL federation

If we want to use [GraphQL federation](https://www.apollographql.com/docs/federation/), you can use sangria to provide a service subgraph.
For that, use the [sangria-federated](https://github.com/sangria-graphql/sangria-federated/) library that supports Federation v1 and v2.

## Helpers

There are quite a few helpers available which you may find useful in different situations.

### Introspection Result Parsing

Sometimes you would like to work with the results of an introspection query. This can be necessary in some client-side tools, for instance. Instead of working
directly with JSON (or other raw representations), you can parse it into a set of case classes that allow you to easily work with the whole schema introspection.

You can find a parser function in `sangria.introspection.IntrospectionParser`.

### Determine a Query Operation Type

Sometimes it can be very useful to know the type of query operation. For example you need it if you want to return a different response for subscription queries. `ast.Document` exposes `operationType` and `operation` for this.
