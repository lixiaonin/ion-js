/*!
 * Copyright 2012 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License").
 * You may not use this file except in compliance with the License.
 * A copy of the License is located at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * or in the "license" file accompanying this file. This file is distributed
 * on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 * express or implied. See the License for the specific language governing
 * permissions and limitations under the License.
 */

import { CharCodes } from "./IonText";
import { State, TextWriter } from "./IonTextWriter";
import { IonType } from "./IonType";
import { IonTypes } from "./IonTypes";
import { Writeable } from "./IonWriteable";

type Serializer<T> = (value: T) => void;

/*
 * This class and functionality carry no guarantees of correctness or support.
 * Do not rely on this functionality for more than front end formatting.
 */
export class PrettyTextWriter extends TextWriter {
  private indentCount: number = 0;
  private readonly prettify_depth: number;

  constructor(writeable: Writeable,
              private readonly indentSize: number = 2,
              prettify_depth: number = Infinity) {
    super(writeable);
    this.prettify_depth = prettify_depth;
  }

  writeFieldName(fieldName: string): void {
    if (this.currentContainer.containerType !== IonTypes.STRUCT) {
      throw new Error("Cannot write field name outside of a struct");
    }
    if (this.currentContainer.state !== State.STRUCT_FIELD) {
      throw new Error("Expecting a struct value");
    }

    if (!this.currentContainer.clean) {
      this.writeable.writeByte(CharCodes.COMMA);
      this.writePrettyNewLine(0);
    }

    this.writePrettyIndent(0);
    this.writeSymbolToken(fieldName);
    this.writeable.writeByte(CharCodes.COLON);
    this.writeable.writeByte(CharCodes.SPACE);

    this.currentContainer.state = State.VALUE;
  }

  writeNull(type: IonType): void {
    if (type === undefined || type === null) {
      type = IonTypes.NULL;
    }
    this.handleSeparator();
    this.writePrettyValue();
    this.writeAnnotations();
    this._writeNull(type);
    if (this.currentContainer.containerType === IonTypes.STRUCT) {
      this.currentContainer.state = State.STRUCT_FIELD;
    }
  }

  stepOut(): void {
    const currentContainer = this.containerContext.pop();
    if (!currentContainer || !currentContainer.containerType) {
      throw new Error("Can't step out when not in a container");
    } else if (
      currentContainer.containerType === IonTypes.STRUCT &&
      currentContainer.state === State.VALUE
    ) {
      throw new Error("Expecting a struct value");
    }

    if (this.depth() < this.prettify_depth - 1) {
      if (!currentContainer.clean) {
        this.writePrettyNewLine(0);
      }
      this.writePrettyIndent(-1);
    }

    switch (currentContainer.containerType) {
      case IonTypes.LIST:
        this.writeable.writeByte(CharCodes.RIGHT_BRACKET);
        break;
      case IonTypes.SEXP:
        this.writeable.writeByte(CharCodes.RIGHT_PARENTHESIS);
        break;
      case IonTypes.STRUCT:
        this.writeable.writeByte(CharCodes.RIGHT_BRACE);
        break;
      default:
        throw new Error("Unexpected container type");
    }
  }

  _serializeValue<T>(type: IonType, value: T, serialize: Serializer<T>) {
    if (this.currentContainer.state === State.STRUCT_FIELD) {
      throw new Error("Expecting a struct field");
    }
    if (value === null) {
      this.writeNull(type);
      return;
    }

    this.handleSeparator();
    this.writePrettyValue();
    this.writeAnnotations();
    serialize(value);
    if (this.currentContainer.containerType === IonTypes.STRUCT) {
      this.currentContainer.state = State.STRUCT_FIELD;
    }
  }

  writeContainer(type: IonType, openingCharacter: number): void {
    if (
      this.currentContainer.containerType === IonTypes.STRUCT &&
      this.currentContainer.state === State.VALUE
    ) {
      this.currentContainer.state = State.STRUCT_FIELD;
    }
    this.handleSeparator();
    this.writePrettyValue();
    this.writeAnnotations();
    this.writeable.writeByte(openingCharacter);
    if (this.depth() < this.prettify_depth - 1) {
      this.writePrettyNewLine(1);
    }
    this._stepIn(type);
  }

  handleSeparator(): void {
    if (this.depth() === 0) {
      if (this.currentContainer.clean) {
        this.currentContainer.clean = false;
      } else {
        this.writeable.writeByte(CharCodes.LINE_FEED);
      }
    } else {
      if (this.currentContainer.clean) {
        this.currentContainer.clean = false;
      } else {
        switch (this.currentContainer.containerType) {
          case IonTypes.LIST:
            this.writeable.writeByte(CharCodes.COMMA);
            if (this.depth() < this.prettify_depth) {
              this.writePrettyNewLine(0);
            }
            break;
          case IonTypes.SEXP:
            this.writeable.writeByte(CharCodes.SPACE);
            if (this.depth() < this.prettify_depth) {
              this.writePrettyNewLine(0);
            }
            break;
          default:
          // no op
        }
      }
    }
  }

  private writePrettyValue(): void {
    if (
      this.depth() > 0 &&
      this.currentContainer.containerType &&
      this.currentContainer.containerType !== IonTypes.STRUCT
    ) {
      this.writePrettyIndent(0);
    }
  }

  private writePrettyNewLine(incrementValue: number): void {
    this.indentCount = this.indentCount + incrementValue;
    if (this.indentSize && this.indentSize > 0 && this.depth() < this.prettify_depth) {
      this.writeable.writeByte(CharCodes.LINE_FEED);
    }
  }

  private writePrettyIndent(incrementValue: number): void {
    this.indentCount = this.indentCount + incrementValue;
    if (this.indentSize && this.indentSize > 0 && this.depth() < this.prettify_depth) {
      for (let i = 0; i < this.indentCount * this.indentSize; i++) {
        this.writeable.writeByte(CharCodes.SPACE);
      }
    }
  }
}
