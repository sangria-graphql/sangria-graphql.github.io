The website for the https://sangria-graphql.github.io

## Prerequisites

- install [Ruby](https://www.ruby-lang.org/en/)
- install [Bundler](https://bundler.io/)
  ```
  gem install bundler
  ```
- install local dependencies
  ```
  bundle install
  ```

## Local development

Start local server with:

```bash
bundle exec jekyll serve --watch
```

or with docker:
```
docker compose up
```


And then point browser to [http://localhost:4000](http://localhost:4000). This will also automatically pickup all changes you make.

## Build for GitHub Pages

```bash
bundle exec jekyll b -d docs
```

```
docker build -t sangria-doc .
docker run --rm --volume=$(pwd):/src sangria-doc exec jekyll b -d docs
```

The files in `/doc` is used by Github. You have to push the changes manually for now.
