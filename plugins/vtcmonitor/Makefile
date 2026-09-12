# Makefile — build plugin vtcmonitor ngoài cây TSDuck (out-of-tree).
# Chuẩn official: dùng `tsconfig` từ gói tsduck-dev (xem sample/sample-plugin/Makefile).
# Chạy trong container: cd plugins/vtcmonitor && make
#
# Yêu cầu: tsconfig phải tồn tại (gói tsduck-dev trên Ubuntu, tsduck trên macOS brew).

CXXFLAGS += $(shell tsconfig --cflags)
LDLIBS   += $(shell tsconfig --libs)
SO       := $(shell tsconfig --so)

# Plugin .cpp duy nhất trong thư mục này.
SHLIBS := $(addsuffix $(SO),$(basename $(wildcard tsplugin_*.cpp)))

# Link shared object.
%$(SO): %.o
	$(CC) $(CFLAGS) $(SOFLAGS) $(LDFLAGS) $^ $(LDLIBS) -shared -o $@

# -fPIC bắt buộc cho shared object.
CXXFLAGS += -fPIC -Wall -Wextra

default: $(SHLIBS)
	@true

clean distclean:
	@rm -rf *.o *.so *.dylib

.PHONY: install check
install: $(SHLIBS)
	install -d -m 755 $(DESTDIR)$(shell tsconfig --plugin)
	install -m 755 $(SHLIBS) $(DESTDIR)$(shell tsconfig --plugin)

# Kiểm tra nhanh plugin load được (cần tsp đã cài).
check: $(SHLIBS)
	tsp -P vtcmonitor --help
