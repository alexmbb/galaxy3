import {
  API_BACKEND,
  AUTH_API_BACKEND,
} from "./env";

class Api {

    constructor() {
        this.accessToken = null;
        this.username = null;
        this.password = null;
    }

    fetchConfig = () =>
        this.logAndParse('fetch config', fetch(this.urlFor('/v2/config'), this.defaultOptions()));

    fetchAvailableRooms = () =>
        this.logAndParse('fetch available rooms', fetch(this.urlFor('/groups'), this.defaultOptions()));

    fetchActiveRooms = () =>
        this.logAndParse('fetch active rooms', fetch(this.urlFor('/rooms'), this.defaultOptions()));

    fetchRoom = (id) =>
        this.logAndParse(`fetch room ${id}`, fetch(this.urlFor(`/room/${id}`), this.defaultOptions()));

    fetchUsers = () =>
        this.logAndParse('fetch users', fetch(this.urlFor('/users'), this.defaultOptions()));

    fetchQuad = (col) =>
        this.logAndParse(`fetch quad ${col}`, fetch(this.urlFor(`/qids/q${col}`), this.defaultOptions()));

    updateQuad = (col, data) => {
        const options = {
            ...this.defaultOptions(),
            method: 'PUT',
            body: JSON.stringify(data),
        };
        options.headers['Content-Type'] = 'application/json';
        return this.logAndParse(`update quad ${col}`, fetch(this.urlFor(`/qids/q${col}`), options));
    }

    verifyUser = (pendingEmail, action) => 
        this.logAndParse(`verify user ${pendingEmail}, ${action}`, fetch(this.authUrlFor(`/verify?email=${pendingEmail}&action=${action}`), this.defaultOptions()));

    requestToVerify = (email) => 
        this.logAndParse(`request to verify user ${email}`, fetch(this.authUrlFor(`/request?email=${email}`), this.defaultOptions()), /* responseOnError= */ true);

    fetchUserInfo = () => 
        this.logAndParse(`refresh user info`, fetch(this.authUrlFor('/my_info'), this.defaultOptions()));

    urlFor = (path) => (API_BACKEND + path)
    authUrlFor = (path) => (AUTH_API_BACKEND + path)

    defaultOptions = () => {
        const auth = this.accessToken ?
            `Bearer ${this.accessToken}` :
            `Basic ${btoa(`${this.username}:${this.password}`)}`;

        return {
            headers: {
                'Authorization': auth,
            }
        };
    };

    logAndParse = (action, fetchPromise, responseOnError = false) => {
        return fetchPromise
            .then(response => {
                if (!response.ok) {
                    return Promise.reject(response);
                }
                return response.json();
            })
            .then(data => {
                console.debug(`[API] ${action} success`, data);
                return data;
            })
            .catch(response => {
                console.error(`[API] ${action} error`, response.statusText);
                if (responseOnError) {
                  return Promise.reject(response);
                }
                return Promise.reject(response.statusText);
            });
    }

    setAccessToken = (token) => {
        console.log('setAccessToken', token);
        this.accessToken = token;
    }

    setBasicAuth = (username, password) => {
        this.username = username;
        this.password = password;
    }
}

// Helpers for tests / local dev
class MockApi {
    fetchConfig = () =>
        new Promise((resolve, reject) => resolve({
            gateways: [{name: "gxytest", url: "http://localhost:8088/janus", type: "rooms", token: "secret"}],
            ice_servers: [],
        }))
}

// const defaultApi = new MockApi();

const defaultApi = new Api();

export default defaultApi;
