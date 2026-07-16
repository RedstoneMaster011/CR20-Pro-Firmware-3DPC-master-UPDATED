Import("env")

import random
import re
from pathlib import Path
from SCons.Script import COMMAND_LINE_TARGETS


if "clean" not in COMMAND_LINE_TARGETS:
    header = Path(env.subst("$PROJECT_DIR")) / "Marlin" / "src" / "inc" / "BuildNumber.h"
    contents = header.read_text(encoding="ascii")
    match = re.search(r"^#define BUILD_NUMBER (\d+)$", contents, re.MULTILINE)
    if not match:
        raise RuntimeError("BUILD_NUMBER is missing from {}".format(header))

    current_number = int(match.group(1))
    increase = random.randint(5, 15)
    next_number = current_number + increase
    updated = re.sub(
        r"^#define BUILD_NUMBER \d+\n#define BUILD_NUMBER_STRING \"\d+\"$",
        '#define BUILD_NUMBER {}\n#define BUILD_NUMBER_STRING "{}"'.format(next_number, next_number),
        contents,
        flags=re.MULTILINE,
    )
    header.write_text(updated, encoding="ascii")
    print("Firmware build number: {} (+{})".format(next_number, increase))
