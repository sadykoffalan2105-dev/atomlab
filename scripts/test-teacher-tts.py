import asyncio
import edge_tts

TEXT = "Вещество сохраняет свойства при физических изменениях."

async def main() -> None:
    c = edge_tts.Communicate(TEXT, "ru-RU-DmitryNeural", rate="-12%")
    total = 0
    async for ch in c.stream():
        if ch["type"] == "audio":
            total += len(ch["data"])
    print("bytes", total)

asyncio.run(main())
