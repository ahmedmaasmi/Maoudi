# Voice Agent Debugging Guide

## Quick Test Steps

1. **Verify Server is Running**:
   ```bash
   # Check if server responds
   curl http://localhost:5007/health
   # Should return: {"status":"healthy"}
   ```

2. **Check Browser Console** (F12):
   - Look for `[VoiceAgent]` and `[VoiceChat]` log messages
   - Check for WebSocket connection errors
   - Verify the WebSocket URL: should be `ws://localhost:5007/ws/voice`

3. **Test WebSocket Connection**:
   - Toggle "Live Agent" button in the web app
   - Check console for: `[VoiceChat] Attempting to connect to voice agent...`
   - Should see: `[VoiceChat] Successfully connected to voice agent`

4. **Send a Test Message**:
   - Type a message and press Enter
   - Check console for: `[VoiceChat] Sending message via WebSocket: ...`
   - Check server logs for: `[Voice Agent] Received text message: ...`

## Common Issues

### Issue: "WebSocket is not connected"
**Solution**: Make sure you've toggled the "Live Agent" button ON (should be blue)

### Issue: Connection fails
**Check**:
- Voice agent server is running: `python -m src.server` in `apps/voice-agent`
- Server is on port 5007
- No firewall blocking WebSocket connections

### Issue: Messages sent but no response
**Check**:
- Server logs show: `[Voice Agent] Received text message: ...`
- Server logs show: `[Agent] Calling Ollama with model: ...`
- Ollama is running: `ollama list` should show your model
- Check for errors in server logs

### Issue: Response received but not displayed
**Check**:
- Browser console shows: `[VoiceAgent] Received message: ...`
- Check if `data.text` exists in the response
- Verify the response handler is being called

## Server Log Messages to Look For

When working correctly, you should see:
```
[Voice Agent] Received text message: <your message>
[Agent] Calling Ollama with model: deepseek-r1:1.5b
[Agent] Message history length: <number>
[Agent] Ollama response received
[Agent] Response content: <response>...
[Voice Agent] Sending response: <response>...
```

## Browser Console Messages to Look For

When working correctly, you should see:
```
[VoiceChat] Attempting to connect to voice agent...
[VoiceAgent] Connecting to: ws://localhost:5007/ws/voice
[VoiceChat] Successfully connected to voice agent
[VoiceChat] Live voice agent enabled, checking connection...
[VoiceChat] Sending message via WebSocket: <your message>
[VoiceAgent] Sending text message: {type: "text", message: "...", location: ...}
[VoiceAgent] Received message: {type: "response", text: "..."}
```

## Manual Test

You can test the WebSocket directly using the browser console:

```javascript
const ws = new WebSocket('ws://localhost:5007/ws/voice');
ws.onopen = () => console.log('Connected!');
ws.onmessage = (e) => console.log('Received:', e.data);
ws.onerror = (e) => console.error('Error:', e);
ws.send(JSON.stringify({type: 'text', message: 'Hello'}));
```





