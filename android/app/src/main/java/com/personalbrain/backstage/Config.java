package com.personalbrain.backstage;

/** Constantes partagées par l'application (TWA + notifications). */
final class Config {
    static final String BASE_URL = "https://brain.mprnl.fr";
    static final String DEFAULT_PATH = "/chat";
    static final String PAIR_ENDPOINT = "/api/push/fcm/pair";
    static final String SCHEME = "backstage";

    private Config() {}
}
