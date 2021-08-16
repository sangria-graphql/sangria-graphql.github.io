FROM ruby:2

ENV LC_ALL=C.UTF-8

RUN mkdir /src

COPY Gemfile Gemfile.lock /src/

RUN cd /src \
    && gem install bundler \
    && bundle install
RUN rm -rf /src/Gemfile \
   && rm -rf /src/Gemfile.lock

WORKDIR /src

ENTRYPOINT ["bundle"]

EXPOSE 4000
