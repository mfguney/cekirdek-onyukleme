// SPDX-License-Identifier: MIT
// sensor-oku: örnek ağ geçidi için sensör okuma aracı (benzetim)
#include <stdio.h>
#include <stdlib.h>

int main(int argc, char *argv[])
{
    int adet = 3;

    if (argc > 1) {
        adet = atoi(argv[1]);
        if (adet < 1 || adet > 100) {
            fprintf(stderr, "Kullanım: sensor-oku [1-100 arası okuma sayısı]\n");
            return 1;
        }
    }

    printf("Örnek ağ geçidi · sensör okuması\n");
    for (int i = 0; i < adet; i++) {
        printf("  sensor0  okuma %-3d  %5.1f C\n", i + 1, 21.0 + (i % 5) * 0.4);
    }
    return 0;
}
