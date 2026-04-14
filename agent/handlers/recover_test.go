package handlers

import "testing"

func TestRecoverUTF8MisreadAsLatin1(t *testing.T) {
	// 典型：UTF-8 中文被当成 Latin-1 读成多字符后再以 UTF-8 存储
	in := "å¥½ååç¼©æå¡"
	out := recoverUTF8MisreadAsLatin1(in)
	t.Logf("in=%q out=%q", in, out)
	if out == in {
		t.Fatal("expected recovery")
	}
}
