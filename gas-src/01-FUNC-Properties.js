/**
 * @returns {{subs?: number, views?: number, ts: number}}
 */
function getLastChannelState() {
  try {
    const props = PropertiesService.getScriptProperties();
    let stateJSON = props.getProperty("LAST_CHANNEL_STATE");
    if(!stateJSON) stateJSON = '{}';

    const state = JSON.parse(stateJSON);
    if(typeof state !== 'object' || Array.isArray(state)) throw new Error('Type error');
    if(!state.ts) state.ts = new Date().getTime();
    return state;
  } catch {
    return { ts: new Date().getTime() };
  }
}

/**
 * @param state {{subs: number, views: number, ts?: number}}
 */
function saveChannelState(state) {
  try {
    if(typeof state !== 'object' || Array.isArray(state)) throw new Error('Type error');
    if(!state.ts) state.ts = new Date().getTime();

    const props = PropertiesService.getScriptProperties();
    let stateJSON = JSON.stringify(state);
    if(!stateJSON) stateJSON = '{}';
    props.setProperty("LAST_CHANNEL_STATE", stateJSON);
  } catch(e) {
    Logger.log(`Error saveChannelState : ${parseErrorMsg(e)}`);
  }
}