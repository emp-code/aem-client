CC=gcc
CFLAGS=-O2 -march=native -pipe -std=gnu2x -Wall -Wextra -Wpedantic -Wno-comment -D_GNU_SOURCE -D_FORTIFY_SOURCE=2 -fstack-protector-strong -fcf-protection=full -fPIE -pie -Wl,-z,relro,-z,now -Wl,-z,noexecstack -Werror=alloc-zero -Werror=discarded-array-qualifiers -Werror=implicit-function-declaration -Werror=incompatible-pointer-types -Werror=int-conversion -Werror=return-type -Werror=shadow -Wbad-function-cast -Wbidi-chars=any -Wcast-align -Wcast-qual -Wduplicated-branches -Wfloat-equal -Winvalid-utf8 -Wlogical-op -Wmissing-declarations -Wpadded -Wpointer-arith -Wredundant-decls -Wstack-usage=999999 -Wstrict-prototypes -Wtrampolines -Wunused-macros -Wwrite-strings -fanalyzer -Wformat=0

all: aem-fetcher aem-tester

aem-fetcher: all-ears.c Fetcher/*.c Include/*.c
	$(CC) $(CFLAGS) -o aem-fetcher all-ears.c Include/*.c Fetcher/*.c -lsodium

aem-tester: all-ears.c Tester/*.c Include/*.c
	$(CC) $(CFLAGS) -o aem-tester all-ears.c Include/*.c Tester/*.c -lsodium

.PHONY: clean
clean:
	-rm aem-fetcher aem-tester
