I wanted something simple: a new wallpaper on my Ubuntu desktop every day, picked from a folder of images I already had. I also wanted a small icon in the top bar so I could skip to the next one when I didn't like the day's pick.  

That sounds like a solved problem, and it probably is. But every time I go looking for a tool like this, the same thing happens. I find apps that haven't been updated in years, apps that do far more than I need, apps that want to download images from somewhere I didn't ask for, or apps that simply don't work on the latest Ubuntu. Then I spend an evening installing, testing, and uninstalling things.

So this time I skipped the search and built it myself with the help of AI. It took less time than my usual search would have, and I ended up with a tool that does exactly what I need and nothing else. I called it **sg-wallpaper-rotator**.
## How it works

On Ubuntu's GNOME desktop, the wallpaper is just a setting, and you can change it from the terminal:

```bash
gsettings set org.gnome.desktop.background picture-uri "file:///path/to/image.jpg"
gsettings set org.gnome.desktop.background picture-uri-dark "file:///path/to/image.jpg"
```

Newer Ubuntu versions keep a separate wallpaper for dark mode, so the app sets both.  

For the top-bar icon, Ubuntu ships with the "Ubuntu AppIndicators" extension enabled, which means a normal Python app can put its own icon in the top bar using the AppIndicator library. No GNOME Shell extension needed.

The app runs in the background, checks the date every ten minutes, and switches to the next image when the day changes. The menu shows the current image's name and lets me go to the next, previous, or a random wallpaper, or open the folder to add more images.

## Setting it up

The app needs two packages:

```bash
sudo apt install python3-gi gir1.2-ayatanaappindicator3-0.1
```

And a folder with some images in it:

```bash
mkdir -p ~/Pictures/wallpapers
```

## The code

Here's the full script, saved as `~/bin/sg-wallpaper-rotator.py`:

```python

#!/usr/bin/env python3
# Run this file with Python 3

# Import tools for dates, random numbers, shell commands, file paths, and the GNOME/GTK libraries
import datetime, random, subprocess
from pathlib import Path
import gi
gi.require_version("Gtk", "3.0")
gi.require_version("AyatanaAppIndicator3", "0.1")
from gi.repository import Gtk, GLib, AyatanaAppIndicator3 as AppIndicator

# Settings: the wallpaper folder and the image file types to accept
FOLDER = Path.home() / "Pictures" / "wallpapers"
EXTS = {".jpg", ".jpeg", ".png", ".webp"}


class SgWallpaperRotator:

    # Startup: create the top-bar icon, attach the menu, set today's wallpaper,
    # and start a timer that checks the date every 10 minutes
    def __init__(self):
        self.last_day = datetime.date.today()
        self.index = self.last_day.toordinal()
        self.ind = AppIndicator.Indicator.new(
            "sg-wallpaper-rotator", str(Path.home() / "bin" / "sg-wallpaper-rotator-image.svg"),
            AppIndicator.IndicatorCategory.APPLICATION_STATUS)
        self.ind.set_status(AppIndicator.IndicatorStatus.ACTIVE)
        self.ind.set_menu(self.build_menu())
        self.apply()
        GLib.timeout_add_seconds(600, self.check_new_day)

    # Build the dropdown menu: a greyed-out line showing the current image,
    # a separator, then clickable items that each call a function
    def build_menu(self):
        menu = Gtk.Menu()
        self.current = Gtk.MenuItem(label="Now: –")
        self.current.set_sensitive(False)
        menu.append(self.current)
        menu.append(Gtk.SeparatorMenuItem())
        for label, cb in [("Next wallpaper", self.next), ("Previous wallpaper", self.prev),
                          ("Random", self.rand), ("Open folder", self.open_folder),
                          ("Quit", Gtk.main_quit)]:
            item = Gtk.MenuItem(label=label)
            item.connect("activate", cb)
            menu.append(item)
        menu.show_all()
        return menu

    # Return all image files in the folder, sorted so the order is always the same
    def images(self):
        return sorted(p for p in FOLDER.iterdir() if p.suffix.lower() in EXTS)

    # Pick an image by index (wrapping around at the end), set it as the wallpaper
    # for both light and dark mode, and show its name in the menu
    def apply(self):
        imgs = self.images()
        if not imgs:
            self.current.set_label("No images found")
            return
        img = imgs[self.index % len(imgs)]
        for key in ("picture-uri", "picture-uri-dark"):
            subprocess.run(["gsettings", "set", "org.gnome.desktop.background",
                            key, img.as_uri()])
        self.current.set_label(f"Now: {img.name}")

    # Menu actions: next, previous, random image, or open the folder in the file manager
    def next(self, _): self.index += 1; self.apply()
    def prev(self, _): self.index -= 1; self.apply()
    def rand(self, _): self.index = random.randrange(10**6); self.apply()
    def open_folder(self, _): subprocess.Popen(["xdg-open", str(FOLDER)])

    # Timer check: if the date has changed, move to the next image.
    # Returning True keeps the timer running
    def check_new_day(self):
        today = datetime.date.today()
        if today != self.last_day:
            self.last_day = today
            self.index += 1
            self.apply()
        return True


# Start the app and keep it running, waiting for clicks and timer events
SgWallpaperRotator()
Gtk.main()

```

The trick I like most is how it picks the day's image. It turns today's date into a number and uses `%` to wrap that number around the number of images in the folder. So it cycles through everything and starts over, without needing to save any state.
## Running it and starting it at login

To try it:

```bash
chmod +x ~/bin/sg-wallpaper-rotator.py

~/bin/sg-wallpaper-rotator.py
```

A wallpaper icon appears in the top-right corner, and clicking it opens the menu. To make it start automatically, add `~/.config/autostart/sg-wallpaper-rotator.desktop`:

```ini
[Desktop Entry]
Type=Application
Name=sg-wallpaper-rotator
Exec=/home/YOU/bin/sg-wallpaper-rotator.py
X-GNOME-Autostart-enabled=true
```

## What I took away from this

The tool itself is small, under 80 lines. What stuck with me is how the process changed. For small personal utilities like this, I used to search for an existing app and settle for something close enough. Now it's often faster to describe what I want, build it, and understand it along the way.

It's not magic. I still had to know what I wanted and take the time to understand the code instead of blindly running it. But the distance between "I wish I had a tool that..." and actually having it has become very short.  Cheers !