---
layout: normal-page
animateHeader: false
title: Sangria Downloads
---

## Downloads

The latest version of the library is [{{site.version.sangria}}]({{site.link.sangria-releases}}).
You can view and download the sources directly from the [GitHub repo]({{site.link.sangria-github}}).
If you want want to download jars, then please do so directly from the [maven central]({{site.link.sangria-maven}}).

### sangria

<dl class="dl-horizontal">
  <dt>GitHub</dt><dd><a target="_blank" href="{{site.link.repo.sangria}}">sangria</a></dd>
  <dt>Latest version</dt><dd><a target="_blank" href="{{site.link.sangria-releases}}">{{site.version.sangria}}</a></dd>
  <dt>Maven central</dt><dd>
    for scala <a target="_blank" href="{{site.link.maven.sangria}}2.11%7C{{site.version.sangria}}%7Cjar">2.11</a>
  </dd>
</dl>

You can use following dependency in your SBT build:

{% highlight scala %}
libraryDependencies += "{{site.groupId}}" %% "sangria" % "{{site.version.sangria}}"
{% endhighlight %}

### sangria-relay

<dl class="dl-horizontal">
  <dt>GitHub</dt><dd><a target="_blank" href="{{site.link.repo.sangria-relay}}">sangria-relay</a></dd>
  <dt>Latest version</dt><dd><a target="_blank" href="{{site.link.sangria-relay-releases}}">{{site.version.sangria-relay}}</a></dd>
  <dt>Maven central</dt><dd>
    for scala <a target="_blank" href="{{site.link.maven.sangria-relay}}2.11%7C{{site.version.sangria-relay}}%7Cjar">2.11</a>
  </dd>
</dl>

You can use following dependency in your SBT build:

{% highlight scala %}
libraryDependencies += "{{site.groupId}}" %% "sangria-relay" % "{{site.version.sangria-relay}}"
{% endhighlight %}

