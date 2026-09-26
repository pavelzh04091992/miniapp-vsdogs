#!/usr/bin/env python3
"""Expose staged Yandex videos under media/<id>/video.mp4 without duplicating data."""

import json
import os
from pathlib import Path


APP_ROOT = Path(__file__).resolve().parents[1]
CATALOG_PATH = APP_ROOT / "src" / "local-video-catalog.json"
STAGING_ROOT = Path("/opt/miniapp/video-import-yandex")
MEDIA_ROOT = APP_ROOT / "media"


def main() -> None:
    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    linked = 0

    for media_id, relative_source in catalog["mediaFiles"].items():
        source = STAGING_ROOT / relative_source.lstrip("/")
        target_dir = MEDIA_ROOT / media_id
        target = target_dir / "video.mp4"

        if not source.is_file():
            raise FileNotFoundError(f"Missing staged video: {source}")

        target_dir.mkdir(parents=True, exist_ok=True)
        if target.exists():
            if os.path.samefile(source, target):
                linked += 1
                continue
            raise FileExistsError(f"Refusing to replace existing media: {target}")

        os.link(source, target)
        linked += 1

    print(f"Linked {linked} local videos into {MEDIA_ROOT}")


if __name__ == "__main__":
    main()
