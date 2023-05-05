import { default as YAML } from './js-yaml.js'
import { Vector3 } from './Vector3.js'

function parseVectors(json) {
    /*
    Recursively convert json values to vectors if they starts with 'v3_'. 
    */
    for (const k in json) {
        if (k.startsWith('v3_')) {
            json[k] = new Vector3(json[k]);
        }
        else if (k.startsWith('j_')) {
            json[k] = parseVectors(json[k]);
        }
        else if (k.startsWith('a_')) {
            // assume array of JSON
            for (let i=0; i < json[k].length; i++) {
                json[k][i] = parseVectors(json[k][i]);
            }
        }
    }
    return json;
}

export function parseSceneYaml(s_yaml) {
    const raw_parsed = YAML.load(s_yaml);
    return parseVectors(raw_parsed);
}