import asyncio
import edge_tts


async def main() -> None:
    communicate = edge_tts.Communicate("Привет", "ru-RU-DmitryNeural", rate="-8%")
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            print("ok", len(chunk["data"]))
            return
    print("fail")


asyncio.run(main())
