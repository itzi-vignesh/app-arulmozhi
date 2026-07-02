import asyncio
import httpx

async def main():
    url = "http://209.38.124.237/biometric/api/bio_66f4eaa6a199178b5c9999ad3501e8078a9156c4b8a4d452a456517dcc964c12/attendance/daily-log"
    params = {"date": "2026-06-30"}
    async with httpx.AsyncClient() as client:
        try:
            print(f"Calling url: {url} with params {params}")
            resp = await client.get(url, params=params)
            print(f"Status code: {resp.status_code}")
            print(f"Response: {resp.text[:1000]}")
        except Exception as e:
            print(f"Error: {e}")

asyncio.run(main())
