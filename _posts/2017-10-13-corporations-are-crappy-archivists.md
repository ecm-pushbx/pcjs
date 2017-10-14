---
layout: post
title: Corporations Are Crappy Archivists
date: 2017-10-13 10:00:00
permalink: /blog/2017/10/13/
---

In my all-too-brief but soon-to-be-revisited blog post "[Of Mice And When](/blog/2017/08/28/)", I mentioned that
there seemed to be a lot of confusion on the Internet regarding the Microsoft Bus Mouse and the Microsoft Inport Mouse.
I even found some [software](https://github.com/fr1tz/aimsgui/blob/master/aid/os/pc/devmouse.c) that claimed to emulate
a "microsoft bus mouse" but was actually emulating an Inport mouse.
{{ comment }} There's even some confusion about whether the Inport mouse is the same as a PS/2 mouse, since both mice
use vaguely similar ("round") connectors.  Someone a long time ago should have decided that since keyboard connectors
were round, mouse connectors should be square.  Then we wouldn't have people trying to put square pegs into round holes.
{{ endcomment }}

Thankfully, one decidedly [unconfused person](http://www.os2museum.com) sent me a link to his
[Bus Mouse](https://www.virtualbox.org/svn/vbox/trunk/src/VBox/ExtPacks/BusMouseSample/BusMouse.cpp) emulation,
which includes the following prologue that gets it exactly right:

	The Microsoft Bus Mouse was an early mouse sold by Microsoft, originally
	introduced in 1983. The mouse had a D-shaped 9-pin connector which plugged
	into a small ISA add-in board.
	
	The mouse itself was very simple (compared to a serial mouse) and most of the
	logic was located on the ISA board. Later, Microsoft sold an InPort mouse,
	which was also called a "bus mouse", but used a different interface.
	
	Microsoft part numbers for the Bus Mouse were 037-099 (100 ppi)
	and 037-199 (200 ppi).
	
	The Bus Mouse adapter included IRQ configuration jumpers (ref. MS article
	Q12230). The IRQ could be set to one of 2, 3, 4, 5. The typical setting
	would be IRQ 2 for a PC/XT and IRQ 5 for an AT compatible. Because IRQ 5
	may conflict with a SoundBlaster or a PCI device, this device defaults to
	IRQ 3. Note that IRQ 3 is also used by the COM 2 device, not often needed.
	
	The ISA adapter was built around an Intel 8255A compatible chip (ref.
	MS article Q46369). Once enabled, the adapter raises the configured IRQ
	30 times per second; the rate is not configurable. The interrupts
	occur regardless of whether the mouse state has changed or not.
	
	To function properly, the 8255A must be programmed as follows:
	 - Port A: Input. Used to read motion deltas and button states.
	 - Port B: Output. Not used except for mouse detection.
	 - Port C: Split. Upper bits set as output, used for control purposes.
	                  Lower bits set as input, reflecting IRQ state.
	
	Detailed information was gleaned from Windows and OS/2 DDK mouse samples.

This is one of the telltale signs of a conscientious programmer: comments that are relevant, detailed, accurate,
and provide invaluable context that source code alone does not.

Anyway, I wanted to supplement this information with the Microsoft KnowledgeBase articles that he referenced;
specifically:

- Q12230
- Q46369

I thought this would be a trivial task ("OK Google").  Even the author of those comments seemed confident
that merely citing the KB articles by their unique "Q" identifier was more than sufficient.  Surely anyone
who cared to read those articles could simply pull up their nearest KnowledgeBase database and immediately
access them.

I was wrong.

Long story short, Google was a bust.  But worse than that, Microsoft.com was a bust ("No results found for Q12230").
Which is sad, given that Microsoft wrote all these articles.  Microsoft doesn't even appear to remember that they were
called "KnowledgeBase" articles, *not* "[Knowledge Base](https://technet.microsoft.com/en-us/library/cc938660.aspx)",
and they certainly weren't specific to Windows 2000.  Even so, clicking on [http://windows.microsoft.com/windows2000/reskit/webresources](http://windows.microsoft.com/windows2000/reskit/webresources)
just took me to the "[Windows IT Pro Center](https://www.microsoft.com/en-us/itpro/windows)", which looked more like
shopping page than a resource page.  If there was a link to KnowledgeBase articles anywhere on that page, it was well
hidden.

But, I figured that's OK, because I've got enough old MSDN Library CDs to create a tower that would rival any
Jenga structure, and surely these articles would be on one of those.

I was wrong.

For example, Microsoft Developer Studio, circa 1996, was a bust.  It definitely contained *some* KnowledgeBase
articles, just not the ones I was interested in.

![Screenshot of Microsoft Developer Studio circa 1996](/blog/images/win95-vc42-msdn.jpg)

And Visual Studio 2003's MSDN Library was no better.

![Screenshot of Microsoft Visual Studio 2003 MSDN Library](/blog/images/winxp-vs2003-msdn.jpg)

It wasn't until I tried some old Microsoft Programmer's Library CD-ROMs, circa 1991, that I finally had success.

![Screenshot of Microsoft Programmer's Library 1.03: Q12230](/blog/images/mspl103-q12230.jpg)

![Screenshot of Microsoft Programmer's Library 1.03: Q46369](/blog/images/mspl103-q46369.jpg)

Using the "[Microsoft Programmer's Library 1.03](/pubs/pc/reference/microsoft/mspl13/)" CD-ROM and searching within
the "MS KnowledgeBase - C" section of the "C References Library" did the trick.

The organization of KB articles on that CD-ROM is somewhat haphazard.  For example, many of the articles filed
under "MS KnowledgeBase - C" (including the two I was looking for) have nothing to do with C.  And other libraries
on the CD-ROM, like those for MS-DOS or Hardware, contain no KnowledgeBase articles at all.  And some of the KB
collections, like "MS KnowledgeBase - OS/2", have had all their metadata stripped, including the original KB article
number, which is a bit disappointing.

But what's most disappointing of all is that Microsoft clearly doesn't care about this information.  Years ago,
someone there probably made the calculated decision that there was no financial incentive for the company to maintain
the information any longer, despite the substantial investment they made to produce it in the first place, and since
they're not in the "archiving" business, it might as well be removed.

The problem is that no one else is able to access it either, even people who *are* in the "archiving" business.
And you can't exactly walk into Microsoft and file a "records request", like you can at the National Archives or a
public library.  It also seems rather presumptuous for Microsoft to determine, based largely on its own self-interest,
what the "shelf life" of this information should be.  It's certainly their right, but it's not a right that should
be encouraged.

In an effort to unlock this data from an ancient CD-ROM that few people still have or even know what it contains,
I've taken all the KB articles from the "MS KnowledgeBase - C" section and created a small archive within the PCjs
Project.  We can now finally provide links to both of the KB articles referenced above:

- [Q12230: IRQ Settings and Mouse Installation](/pubs/pc/reference/microsoft/kb/Q12230/)
- [Q46369: InPort/Bus Mouse Comparison and Overview](/pubs/pc/reference/microsoft/kb/Q46369/)

so that anyone else looking for KB articles from that era might have an easier time, but more importantly, so that
the information is *preserved* in a meaningful and useful way.

Finally, a shout-out to [neozeed](https://virtuallyfun.superglobalmegacorp.com/2012/07/05/2133/), who came up with
a clever brute-force way of extracting all the raw text from the Programmer's Library CD-ROM.  It was this raw text
that I used to create my small KB archive.  The only downside of that method of extraction is that all "hyperlinking"
information was lost.

*[@jeffpar](http://twitter.com/jeffpar)*  
*Oct 13, 2017*