// Please forgive me for this terrible JS code...
// I just was trying to do make it work as quickly as possible
// in order to be able to concentrate more on the actual content
$(function () {
  var animateHeader = "" + $(document.body).data('animate-header')

  var headerShow = function () {
    var y = $(this).scrollTop();

    if (y > 5) {
      $('.navbar-fixed-top').addClass("with-shadow");
      $('.navbar-fixed-top .navbar-nav .active').removeClass("top-rounded");
      $('.header-logo').fadeIn(300);
      $('.header-description').fadeIn(300);
    } else {
      $('.navbar-fixed-top').removeClass("with-shadow");
      $('.navbar-fixed-top .navbar-nav .active').addClass("top-rounded");
      $('.header-logo').fadeOut(100);
      $('.header-description').fadeOut(100);
    }
  }

  var simpleHeaderShow = function () {
    var y = $(this).scrollTop();

    if (y > 5) {
      $('.navbar-fixed-top').addClass("with-shadow");
    } else {
      $('.navbar-fixed-top').removeClass("with-shadow");
    }
  }

  if (animateHeader === 'true') {
    $(document).scroll(headerShow)
    $(document).resize(headerShow)
  } else {
    $('.navbar-fixed-top')
    $('.navbar-fixed-top .navbar-nav .active').removeClass("top-rounded");
    $('.header-logo').show();
    $('.header-description').show();

    $(document).scroll(simpleHeaderShow)
    $(document).resize(simpleHeaderShow)
  }

  var slagify = function (text) {
    return text.toLowerCase().replace(/[^\w \-]+/g,'').replace(/ +/g,'-')
  }

  $("h2, h3").each(function () {
    var me = $(this)
    var slug = slagify(me.text())

    me.append($('<a class="link-link" href="#' + slug + '"><span class="glyphicon glyphicon-link"></span></a>'))
  })

  // Monkey patching! Yay! :(
  var patchBootstrap = function () {
    $.fn.scrollspy.Constructor.prototype.refresh = function () {
      var offsetMethod = this.$element[0] == window ? 'offset' : 'position'

      this.offsets = $([])
      this.targets = $([])

      var self = this
      this.$body
          .find(this.selector)
          // just wonder why it was here in the first place
//          .filter(':visible')
          .map(function () {
            var $el   = $(this)
            var href  = $el.data('target') || $el.attr('href')
            var $href = /^#./.test(href) && ($(href).attr('id') ? $(href) : $(href).parent()) // taking parent because in our case it's H2

            return ($href
                && $href.length
                && $href.is(':visible')
                && [[ $href[offsetMethod]().top + (!$.isWindow(self.$scrollElement.get(0)) && self.$scrollElement.scrollTop()), href ]]) || null
          })
          .sort(function (a, b) { return a[0] - b[0] })
          .each(function () {
            self.offsets.push(this[0])
            self.targets.push(this[1])
          })
    }
  }

  $('#sidebar').each(function () {
    patchBootstrap()
    var top = $(this)
    var sidebar = $('<ul class="nav nav-stacked fixed">').appendTo(top)

    var headers = []

    $('.main-content :header').each(function () {
      var header = $(this)
      if (header.prop('tagName') === 'H2') {
        headers.push({header: header, children: []})
      } else if (header.prop('tagName') === 'H3') {
        headers[headers.length - 1].children.push(header)
      }
    })

    $(headers).each(function () {
      var topHeader = this.header
      var topId = (topHeader.attr('id') ? topHeader : topHeader.find('.a-link')).attr('id')
      var topListElem = $('<li><a href="#' + topId + '">' + topHeader.data("orig-text") + '</a></li>').appendTo(sidebar)

      var children = $(this.children).map(function () {
        var subHeader = $(this)
        var subId = (subHeader.attr('id') ? subHeader : subHeader.find('.a-link')).attr('id')

        return $('<li><a href="#' + subId + '">' + subHeader.data("orig-text") + '</a></li>')
      })

      if (children.length > 0) {
        var subList = $('<ul class="nav nav-stacked">').appendTo(topListElem)

        children.each(function () {
          subList.append(this)
        })
      }
    })

    setTimeout(function () {
      $('body').scrollspy({
        target: '#' + top.attr('id'),
        offset: 10
      })
    },100)

    $('a').each(function () {
      if (this.hostname !== window.location.hostname)
        $(this).attr('target', '_blank')
    })
  })
})
