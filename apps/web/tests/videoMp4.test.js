import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planMp4, mp4Name, extOf, codecName, VIDEO_EXTS } from '../src/lib/videoMp4.js';

test('H.264·AAC는 다시 압축하지 않고 옮겨 담기만', () => {
  assert.deepEqual(planMp4({ video: 'avc', audio: 'aac', ext: 'mov' }), { video: 'copy', audio: 'copy', fast: true, already: false });
  assert.deepEqual(planMp4({ video: 'avc', audio: null, ext: 'mkv' }), { video: 'copy', audio: 'none', fast: true, already: false });
});

test('이미 어디서나 재생되는 MP4', () => {
  assert.equal(planMp4({ video: 'avc', audio: 'aac', ext: 'MP4' }).already, true);
  assert.equal(planMp4({ video: 'avc', audio: 'aac', ext: 'm4v' }).already, true);
  assert.equal(planMp4({ video: 'hevc', audio: 'aac', ext: 'mp4' }).already, false);
  assert.equal(planMp4({ video: 'avc', audio: 'opus', ext: 'mp4' }).already, false);
});

test('HEVC(아이폰)는 기본으로 H.264로 다시 만들고, 원하면 그대로 담기', () => {
  assert.deepEqual(planMp4({ video: 'hevc', audio: 'aac' }), { video: 'encode', audio: 'copy', fast: false, already: false });
  assert.deepEqual(planMp4({ video: 'hevc', audio: 'aac' }, { keepHevc: true }), { video: 'copy', audio: 'copy', fast: true, already: false });
});

test('WebM·MKV 코덱은 H.264·AAC로', () => {
  assert.deepEqual(planMp4({ video: 'vp9', audio: 'opus' }), { video: 'encode', audio: 'encode', fast: false, already: false });
  assert.equal(planMp4({ video: 'av1', audio: 'vorbis' }).video, 'encode');
  assert.equal(planMp4({ video: 'avc', audio: 'mp3' }).audio, 'encode');
  assert.equal(planMp4({ video: 'avc', audio: 'mp3' }).fast, false);
});

test('읽을 수 없는 영상', () => {
  assert.equal(planMp4({ video: 'prores', audio: 'aac' }).video, 'unsupported');
  assert.equal(planMp4({ video: null, audio: 'aac' }).video, 'unsupported');
});

test('파일 이름·확장자·코덱 이름', () => {
  assert.equal(mp4Name('IMG_1234.MOV'), 'IMG_1234.mp4');
  assert.equal(mp4Name('영상.webm'), '영상.mp4');
  assert.equal(mp4Name('a.mp4'), 'a_변환.mp4');
  assert.equal(mp4Name('a.b.mkv'), 'a.b.mp4');
  assert.equal(extOf('IMG.MOV'), 'mov');
  assert.equal(extOf('noext'), '');
  assert.equal(codecName('hevc'), 'HEVC (H.265)');
  assert.equal(codecName('aac', 'audio'), 'AAC');
  assert.equal(codecName(null, 'audio'), '없음');
  assert.ok(!VIDEO_EXTS.includes('avi'));
});
